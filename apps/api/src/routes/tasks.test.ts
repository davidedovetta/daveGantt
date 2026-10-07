import type { Role, Task } from '@davegantt/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, csrfHeaders, registerUser, resetDb } from '../../test/helpers.js';
import type { App } from '../app.js';

type TestUser = Awaited<ReturnType<typeof registerUser>>;

describe('task routes', () => {
  let app: App;
  let owner: TestUser;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb(app.db);
    owner = await registerUser(app);
    workspaceId = (
      await app.db.workspaceMember.findFirstOrThrow({ where: { userId: owner.user.id } })
    ).workspaceId;
    const res = await app.inject({
      method: 'POST',
      url: `/workspaces/${workspaceId}/projects`,
      headers: csrfHeaders,
      cookies: owner.cookies,
      payload: { name: 'P' },
    });
    projectId = res.json().id;
  });
  afterAll(async () => {
    await app.close();
  });

  async function member(role: Role) {
    const u = await registerUser(app);
    await app.db.workspaceMember.create({ data: { workspaceId, userId: u.user.id, role } });
    return u;
  }

  const send = (as: TestUser, method: 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: csrfHeaders, cookies: as.cookies, payload });

  async function createTask(
    body: Record<string, unknown> = {},
    as: TestUser = owner,
  ): Promise<Task> {
    const res = await send(as, 'POST', `/projects/${projectId}/tasks`, {
      name: 'Task',
      startDate: '2026-10-05',
      endDate: '2026-10-09',
      ...body,
    });
    if (res.statusCode !== 201) throw new Error(`create failed: ${res.statusCode} ${res.body}`);
    return res.json();
  }

  async function orderedNames() {
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${projectId}`,
      cookies: owner.cookies,
    });
    return (res.json().tasks as Task[]).map((t) => `${t.parentId ? '  ' : ''}${t.name}`);
  }

  describe('create', () => {
    it('creates tasks in order and returns calendar dates as strings', async () => {
      const a = await createTask({ name: 'A' });
      expect(a).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-09', version: 1 });
      const c = await createTask({ name: 'C' });
      await createTask({ name: 'B', afterId: a.id });
      await createTask({ name: 'First', afterId: null });
      expect(await orderedNames()).toEqual(['First', 'A', 'B', 'C']);
      expect(c.parentId).toBeNull();
    });

    it('makes milestones single-day and validates dates', async () => {
      const m = await createTask({ type: 'MILESTONE', endDate: '2026-10-20' });
      expect(m.endDate).toBe('2026-10-05');

      const reversed = await send(owner, 'POST', `/projects/${projectId}/tasks`, {
        name: 'X',
        startDate: '2026-10-09',
        endDate: '2026-10-05',
      });
      expect(reversed.statusCode).toBe(400);
      expect(reversed.json().error.code).toBe('INVALID_DATES');

      const impossible = await send(owner, 'POST', `/projects/${projectId}/tasks`, {
        name: 'X',
        startDate: '2026-02-30',
        endDate: '2026-03-01',
      });
      expect(impossible.statusCode).toBe(400);
    });

    it('rejects a parent from another project', async () => {
      const other = await app.inject({
        method: 'POST',
        url: `/workspaces/${workspaceId}/projects`,
        headers: csrfHeaders,
        cookies: owner.cookies,
        payload: { name: 'Other' },
      });
      const foreign = await send(owner, 'POST', `/projects/${other.json().id}/tasks`, {
        name: 'F',
        startDate: '2026-10-05',
        endDate: '2026-10-05',
      });
      const res = await send(owner, 'POST', `/projects/${projectId}/tasks`, {
        name: 'X',
        startDate: '2026-10-05',
        endDate: '2026-10-05',
        parentId: foreign.json().id,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('INVALID_PARENT');
    });
  });

  describe('update', () => {
    it('updates fields and bumps the version', async () => {
      const t = await createTask();
      const res = await send(owner, 'PATCH', `/tasks/${t.id}`, {
        version: 1,
        name: 'Renamed',
        progress: 50,
        endDate: '2026-10-14',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        name: 'Renamed',
        progress: 50,
        endDate: '2026-10-14',
        version: 2,
      });
    });

    it('rejects stale versions with 409', async () => {
      const t = await createTask();
      await send(owner, 'PATCH', `/tasks/${t.id}`, { version: 1, name: 'First' });
      const stale = await send(owner, 'PATCH', `/tasks/${t.id}`, { version: 1, name: 'Second' });
      expect(stale.statusCode).toBe(409);
      expect(stale.json().error.code).toBe('VERSION_CONFLICT');
    });

    it('rejects end before start after merging with stored values', async () => {
      const t = await createTask();
      const res = await send(owner, 'PATCH', `/tasks/${t.id}`, {
        version: 1,
        startDate: '2026-10-20',
      });
      expect(res.statusCode).toBe(400);
    });

    it('only accepts workspace members as assignees', async () => {
      const t = await createTask();
      const editor = await member('EDITOR');
      const outsider = await registerUser(app);
      const bad = await send(owner, 'PATCH', `/tasks/${t.id}`, {
        version: 1,
        assigneeId: outsider.user.id,
      });
      expect(bad.json().error.code).toBe('INVALID_ASSIGNEE');
      const ok = await send(owner, 'PATCH', `/tasks/${t.id}`, {
        version: 1,
        assigneeId: editor.user.id,
      });
      expect(ok.json().assigneeId).toBe(editor.user.id);
    });

    it('keeps summary dates and progress read-only', async () => {
      const parent = await createTask({ name: 'Parent' });
      await createTask({ name: 'Child', parentId: parent.id });
      const res = await send(owner, 'PATCH', `/tasks/${parent.id}`, { version: 1, progress: 10 });
      expect(res.json().error.code).toBe('SUMMARY_READ_ONLY');
      const rename = await send(owner, 'PATCH', `/tasks/${parent.id}`, {
        version: 1,
        name: 'Fase 1',
      });
      expect(rename.statusCode).toBe(200);
    });
  });

  describe('move', () => {
    it('indents and outdents', async () => {
      const a = await createTask({ name: 'A' });
      const b = await createTask({ name: 'B' });
      await createTask({ name: 'C' });

      const indent = await send(owner, 'POST', `/tasks/${b.id}/move`, {
        parentId: a.id,
        afterId: null,
      });
      expect(indent.json()).toMatchObject({ parentId: a.id, version: 2 });
      expect(await orderedNames()).toEqual(['A', '  B', 'C']);

      await send(owner, 'POST', `/tasks/${b.id}/move`, { parentId: null, afterId: a.id });
      expect(await orderedNames()).toEqual(['A', 'B', 'C']);
    });

    it('refuses to move a task under itself or its descendants', async () => {
      const a = await createTask({ name: 'A' });
      const b = await createTask({ name: 'B', parentId: a.id });
      const self = await send(owner, 'POST', `/tasks/${a.id}/move`, {
        parentId: a.id,
        afterId: null,
      });
      const descendant = await send(owner, 'POST', `/tasks/${a.id}/move`, {
        parentId: b.id,
        afterId: null,
      });
      expect(self.statusCode).toBe(400);
      expect(descendant.statusCode).toBe(400);
    });

    it('rejects an afterId that is not a sibling under the new parent', async () => {
      const a = await createTask({ name: 'A' });
      const b = await createTask({ name: 'B' });
      const res = await send(owner, 'POST', `/tasks/${b.id}/move`, {
        parentId: a.id,
        afterId: a.id,
      });
      expect(res.json().error.code).toBe('INVALID_POSITION');
    });
  });

  describe('delete', () => {
    it('deletes the task with its subtasks', async () => {
      const a = await createTask({ name: 'A' });
      await createTask({ name: 'A1', parentId: a.id });
      await createTask({ name: 'B' });
      expect((await send(owner, 'DELETE', `/tasks/${a.id}`)).statusCode).toBe(204);
      expect(await orderedNames()).toEqual(['B']);
    });
  });

  describe('authorization', () => {
    it('lets viewers read but not write, and hides tasks from outsiders', async () => {
      const t = await createTask();
      const viewer = await member('VIEWER');
      const outsider = await registerUser(app);

      for (const as of [viewer, outsider]) {
        const expected = as === viewer ? 403 : 404;
        expect(
          (
            await send(as, 'POST', `/projects/${projectId}/tasks`, {
              name: 'X',
              startDate: '2026-10-05',
              endDate: '2026-10-05',
            })
          ).statusCode,
        ).toBe(expected);
        expect(
          (await send(as, 'PATCH', `/tasks/${t.id}`, { version: 1, name: 'X' })).statusCode,
        ).toBe(expected);
        expect(
          (await send(as, 'POST', `/tasks/${t.id}/move`, { parentId: null, afterId: null }))
            .statusCode,
        ).toBe(expected);
        expect((await send(as, 'DELETE', `/tasks/${t.id}`)).statusCode).toBe(expected);
      }
    });

    it('lets editors write', async () => {
      const editor = await member('EDITOR');
      const t = await createTask({}, editor);
      const res = await send(editor, 'PATCH', `/tasks/${t.id}`, { version: 1, progress: 30 });
      expect(res.statusCode).toBe(200);
    });
  });
});
