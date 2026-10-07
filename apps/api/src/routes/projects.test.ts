import type { Role } from '@davegantt/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, csrfHeaders, registerUser, resetDb } from '../../test/helpers.js';
import type { App } from '../app.js';

type TestUser = Awaited<ReturnType<typeof registerUser>>;

describe('project routes', () => {
  let app: App;
  let owner: TestUser;
  let workspaceId: string;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb(app.db);
    owner = await registerUser(app);
    workspaceId = (
      await app.db.workspaceMember.findFirstOrThrow({ where: { userId: owner.user.id } })
    ).workspaceId;
  });
  afterAll(async () => {
    await app.close();
  });

  async function member(role: Role) {
    const u = await registerUser(app);
    await app.db.workspaceMember.create({ data: { workspaceId, userId: u.user.id, role } });
    return u;
  }

  const create = (as: TestUser, name = 'Sito web', ws = workspaceId) =>
    app.inject({
      method: 'POST',
      url: `/workspaces/${ws}/projects`,
      headers: csrfHeaders,
      cookies: as.cookies,
      payload: { name },
    });

  it('creates and lists projects with an automatic color', async () => {
    const res = await create(owner, '  Sito web ');
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'Sito web', workspaceId, color: '#6366f1' });

    const list = await app.inject({
      method: 'GET',
      url: `/workspaces/${workspaceId}/projects`,
      cookies: owner.cookies,
    });
    expect(list.json()).toHaveLength(1);
  });

  it('lets editors create, viewers only read, outsiders nothing', async () => {
    const editor = await member('EDITOR');
    const viewer = await member('VIEWER');
    const outsider = await registerUser(app);

    expect((await create(editor)).statusCode).toBe(201);
    expect((await create(viewer)).statusCode).toBe(403);
    expect((await create(outsider)).statusCode).toBe(404);

    const project = (await create(owner)).json();
    const get = (as: TestUser) =>
      app.inject({ method: 'GET', url: `/projects/${project.id}`, cookies: as.cookies });
    expect((await get(viewer)).json()).toMatchObject({ role: 'VIEWER', tasks: [] });
    expect((await get(outsider)).statusCode).toBe(404);

    const rename = (as: TestUser) =>
      app.inject({
        method: 'PATCH',
        url: `/projects/${project.id}`,
        headers: csrfHeaders,
        cookies: as.cookies,
        payload: { name: 'Nuovo nome' },
      });
    expect((await rename(viewer)).statusCode).toBe(403);
    expect((await rename(outsider)).statusCode).toBe(404);
    expect((await rename(editor)).json().name).toBe('Nuovo nome');
  });

  it('archiving hides the project everywhere', async () => {
    const project = (await create(owner)).json();
    const del = await app.inject({
      method: 'DELETE',
      url: `/projects/${project.id}`,
      headers: csrfHeaders,
      cookies: owner.cookies,
    });
    expect(del.statusCode).toBe(204);
    const get = await app.inject({
      method: 'GET',
      url: `/projects/${project.id}`,
      cookies: owner.cookies,
    });
    expect(get.statusCode).toBe(404);
    const list = await app.inject({
      method: 'GET',
      url: `/workspaces/${workspaceId}/projects`,
      cookies: owner.cookies,
    });
    expect(list.json()).toEqual([]);
  });
});
