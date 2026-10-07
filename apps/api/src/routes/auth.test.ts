import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, csrfHeaders, registerUser, resetDb } from '../../test/helpers.js';
import type { App } from '../app.js';
import { SESSION_COOKIE } from '../auth/sessions.js';

describe('auth routes', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb(app.db);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates the user, a personal workspace and a session cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: csrfHeaders,
        payload: { email: 'Mario@Example.com', name: 'Mario', password: 'correct-horse-battery' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.user).toMatchObject({ email: 'mario@example.com', name: 'Mario' });
      expect(JSON.stringify(body)).not.toContain('passwordHash');

      const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/', secure: true });

      const memberships = await app.db.workspaceMember.findMany({
        where: { userId: body.user.id },
        include: { workspace: true },
      });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({
        role: 'OWNER',
        workspace: { name: 'Workspace di Mario' },
      });

      const stored = await app.db.user.findUniqueOrThrow({ where: { id: body.user.id } });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('rejects a duplicate email regardless of case', async () => {
      await registerUser(app, { email: 'dup@example.com' });
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: csrfHeaders,
        payload: { email: 'DUP@example.com', name: 'Other', password: 'correct-horse-battery' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('EMAIL_TAKEN');
    });

    it('rejects invalid input with a validation error', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: csrfHeaders,
        payload: { email: 'a@b.it', name: 'A', password: 'short' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'La password deve avere almeno 8 caratteri',
      });
    });

    it('rejects mutating requests without the CSRF header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'a@b.it', name: 'A', password: 'correct-horse-battery' },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('CSRF_REJECTED');
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with valid credentials', async () => {
      const { user, password } = await registerUser(app);
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: csrfHeaders,
        payload: { email: user.email.toUpperCase(), password },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user).toEqual(user);
      expect(res.cookies.some((c) => c.name === SESSION_COOKIE)).toBe(true);
    });

    it('returns the same error for a wrong password and an unknown email', async () => {
      const { user } = await registerUser(app);
      const wrongPassword = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: csrfHeaders,
        payload: { email: user.email, password: 'wrong-password' },
      });
      const unknownEmail = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: csrfHeaders,
        payload: { email: 'nobody@example.com', password: 'wrong-password' },
      });
      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownEmail.statusCode).toBe(401);
      expect(wrongPassword.json()).toEqual(unknownEmail.json());
    });

    it('is rate limited per IP', async () => {
      const limited = await buildTestApp({ authRateLimitMax: 2 });
      try {
        const attempt = () =>
          limited.inject({
            method: 'POST',
            url: '/auth/login',
            headers: csrfHeaders,
            payload: { email: 'nobody@example.com', password: 'x' },
          });
        expect((await attempt()).statusCode).toBe(401);
        expect((await attempt()).statusCode).toBe(401);
        const third = await attempt();
        expect(third.statusCode).toBe(429);
        expect(third.json().error.code).toBe('RATE_LIMITED');
      } finally {
        await limited.close();
      }
    });
  });

  describe('session lifecycle', () => {
    it('GET /auth/me returns the current user', async () => {
      const { user, cookies } = await registerUser(app);
      const res = await app.inject({ method: 'GET', url: '/auth/me', cookies });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ user });
    });

    it('GET /auth/me rejects missing and unknown sessions', async () => {
      const missing = await app.inject({ method: 'GET', url: '/auth/me' });
      const unknown = await app.inject({
        method: 'GET',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE]: 'not-a-real-token' },
      });
      expect(missing.statusCode).toBe(401);
      expect(unknown.statusCode).toBe(401);
    });

    it('rejects and deletes expired sessions', async () => {
      const { user, cookies } = await registerUser(app);
      await app.db.session.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await app.inject({ method: 'GET', url: '/auth/me', cookies });
      expect(res.statusCode).toBe(401);
      expect(await app.db.session.count({ where: { userId: user.id } })).toBe(0);
    });

    it('extends sessions past half their lifetime', async () => {
      const { user, cookies } = await registerUser(app);
      const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await app.db.session.updateMany({ where: { userId: user.id }, data: { expiresAt: soon } });

      const res = await app.inject({ method: 'GET', url: '/auth/me', cookies });
      expect(res.statusCode).toBe(200);
      expect(res.cookies.some((c) => c.name === SESSION_COOKIE)).toBe(true);
      const session = await app.db.session.findFirstOrThrow({ where: { userId: user.id } });
      expect(session.expiresAt.getTime()).toBeGreaterThan(soon.getTime());
    });

    it('POST /auth/logout invalidates the session', async () => {
      const { cookies } = await registerUser(app);
      const logout = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: csrfHeaders,
        cookies,
      });
      expect(logout.statusCode).toBe(204);
      const me = await app.inject({ method: 'GET', url: '/auth/me', cookies });
      expect(me.statusCode).toBe(401);
    });
  });
});
