import type { Role } from '@davegantt/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, csrfHeaders, registerUser, resetDb } from '../../test/helpers.js';
import type { App } from '../app.js';

type TestUser = Awaited<ReturnType<typeof registerUser>>;

describe('member routes', () => {
  let app: App;
  let owner: TestUser;
  let workspaceId: string;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb(app.db);
    owner = await registerUser(app, { name: 'Owner' });
    const m = await app.db.workspaceMember.findFirstOrThrow({ where: { userId: owner.user.id } });
    workspaceId = m.workspaceId;
  });
  afterAll(async () => {
    await app.close();
  });

  async function addMember(role: Role) {
    const u = await registerUser(app);
    await app.db.workspaceMember.create({ data: { workspaceId, userId: u.user.id, role } });
    return u;
  }

  const url = (userId?: string) =>
    `/workspaces/${workspaceId}/members${userId ? `/${userId}` : ''}`;

  const list = (as: TestUser) => app.inject({ method: 'GET', url: url(), cookies: as.cookies });
  const add = (as: TestUser, email: string, role: Role = 'EDITOR') =>
    app.inject({
      method: 'POST',
      url: url(),
      headers: csrfHeaders,
      cookies: as.cookies,
      payload: { email, role },
    });
  const setRole = (as: TestUser, userId: string, role: Role) =>
    app.inject({
      method: 'PATCH',
      url: url(userId),
      headers: csrfHeaders,
      cookies: as.cookies,
      payload: { role },
    });
  const remove = (as: TestUser, userId: string) =>
    app.inject({ method: 'DELETE', url: url(userId), headers: csrfHeaders, cookies: as.cookies });

  describe('GET members', () => {
    it('lists members for any member, hides the workspace from outsiders', async () => {
      const viewer = await addMember('VIEWER');
      const outsider = await registerUser(app);

      const res = await list(viewer);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([
        { userId: owner.user.id, name: 'Owner', email: owner.user.email, role: 'OWNER' },
        {
          userId: viewer.user.id,
          name: viewer.user.name,
          email: viewer.user.email,
          role: 'VIEWER',
        },
      ]);
      expect((await list(outsider)).statusCode).toBe(404);
    });
  });

  describe('POST members', () => {
    it('lets the owner add a registered user by email (case-insensitive)', async () => {
      const colleague = await registerUser(app, { email: 'collega@example.com' });
      const res = await add(owner, 'Collega@Example.com', 'EDITOR');
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ userId: colleague.user.id, role: 'EDITOR' });

      const workspaces = await app.inject({
        method: 'GET',
        url: '/workspaces',
        cookies: colleague.cookies,
      });
      expect(workspaces.json()).toContainEqual(
        expect.objectContaining({ id: workspaceId, role: 'EDITOR' }),
      );
    });

    it('rejects unknown emails and existing members', async () => {
      const editor = await addMember('EDITOR');
      const unknown = await add(owner, 'nobody@example.com');
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json().error.code).toBe('USER_NOT_FOUND');
      const dup = await add(owner, editor.user.email);
      expect(dup.statusCode).toBe(409);
      expect(dup.json().error.code).toBe('ALREADY_MEMBER');
    });

    it('is reserved to owners', async () => {
      const target = await registerUser(app);
      const editor = await addMember('EDITOR');
      const viewer = await addMember('VIEWER');
      const outsider = await registerUser(app);
      expect((await add(editor, target.user.email)).statusCode).toBe(403);
      expect((await add(viewer, target.user.email)).statusCode).toBe(403);
      expect((await add(outsider, target.user.email)).statusCode).toBe(404);
    });
  });

  describe('PATCH member role', () => {
    it('lets the owner change roles', async () => {
      const viewer = await addMember('VIEWER');
      const res = await setRole(owner, viewer.user.id, 'EDITOR');
      expect(res.statusCode).toBe(200);
      expect(res.json().role).toBe('EDITOR');
    });

    it('is reserved to owners', async () => {
      const editor = await addMember('EDITOR');
      const viewer = await addMember('VIEWER');
      expect((await setRole(editor, viewer.user.id, 'EDITOR')).statusCode).toBe(403);
      expect((await setRole(editor, editor.user.id, 'OWNER')).statusCode).toBe(403);
    });

    it('returns 404 for a user who is not a member', async () => {
      const outsider = await registerUser(app);
      expect((await setRole(owner, outsider.user.id, 'EDITOR')).statusCode).toBe(404);
    });

    it('refuses to demote the last owner', async () => {
      const res = await setRole(owner, owner.user.id, 'EDITOR');
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('LAST_OWNER');
    });

    it('keeps one owner when two owners demote each other concurrently', async () => {
      const second = await addMember('OWNER');
      const results = await Promise.all([
        setRole(owner, second.user.id, 'EDITOR'),
        setRole(second, owner.user.id, 'EDITOR'),
      ]);
      const codes = results.map((r) => r.statusCode).sort();
      // The loser either finds itself demoted (403) or would remove the last owner (409).
      expect(codes[0]).toBe(200);
      expect([403, 409]).toContain(codes[1]);
      expect(await app.db.workspaceMember.count({ where: { workspaceId, role: 'OWNER' } })).toBe(1);
    });
  });

  describe('DELETE member', () => {
    it('lets the owner remove a member, who then loses access', async () => {
      const editor = await addMember('EDITOR');
      expect((await remove(owner, editor.user.id)).statusCode).toBe(204);
      expect((await list(editor)).statusCode).toBe(404);
    });

    it('lets any member leave', async () => {
      const viewer = await addMember('VIEWER');
      expect((await remove(viewer, viewer.user.id)).statusCode).toBe(204);
    });

    it('forbids non-owners from removing others', async () => {
      const editor = await addMember('EDITOR');
      const viewer = await addMember('VIEWER');
      expect((await remove(editor, viewer.user.id)).statusCode).toBe(403);
      expect((await remove(viewer, owner.user.id)).statusCode).toBe(403);
    });

    it('refuses to remove the last owner', async () => {
      const res = await remove(owner, owner.user.id);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('LAST_OWNER');
    });

    it('returns 404 for a user who is not a member', async () => {
      const outsider = await registerUser(app);
      expect((await remove(owner, outsider.user.id)).statusCode).toBe(404);
    });
  });
});
