import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, csrfHeaders, registerUser, resetDb } from '../../test/helpers.js';
import type { App } from '../app.js';

describe('workspace routes', () => {
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

  it('GET /workspaces lists only the caller workspaces, with their role', async () => {
    const alice = await registerUser(app, { name: 'Alice' });
    await registerUser(app, { name: 'Bob' });

    const res = await app.inject({ method: 'GET', url: '/workspaces', cookies: alice.cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { id: expect.any(String), name: 'Workspace di Alice', role: 'OWNER' },
    ]);
  });

  it('POST /workspaces creates a workspace owned by the caller', async () => {
    const alice = await registerUser(app);
    const res = await app.inject({
      method: 'POST',
      url: '/workspaces',
      headers: csrfHeaders,
      cookies: alice.cookies,
      payload: { name: '  Team Tinexta ' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'Team Tinexta', role: 'OWNER' });

    const list = await app.inject({ method: 'GET', url: '/workspaces', cookies: alice.cookies });
    expect(list.json()).toHaveLength(2);
  });

  it('requires authentication', async () => {
    const list = await app.inject({ method: 'GET', url: '/workspaces' });
    const create = await app.inject({
      method: 'POST',
      url: '/workspaces',
      headers: csrfHeaders,
      payload: { name: 'X' },
    });
    expect(list.statusCode).toBe(401);
    expect(create.statusCode).toBe(401);
  });
});
