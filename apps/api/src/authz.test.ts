import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, registerUser, resetDb } from '../test/helpers.js';
import type { App } from './app.js';
import { hasRole, requireWorkspaceRole } from './authz.js';

describe('hasRole', () => {
  it('follows OWNER > EDITOR > VIEWER', () => {
    expect(hasRole('OWNER', 'EDITOR')).toBe(true);
    expect(hasRole('EDITOR', 'EDITOR')).toBe(true);
    expect(hasRole('VIEWER', 'EDITOR')).toBe(false);
    expect(hasRole('EDITOR', 'OWNER')).toBe(false);
  });
});

describe('requireWorkspaceRole', () => {
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

  async function workspaceOf(userId: string) {
    const m = await app.db.workspaceMember.findFirstOrThrow({ where: { userId } });
    return m.workspaceId;
  }

  it('returns the role of a member with enough permissions', async () => {
    const { user } = await registerUser(app);
    const workspaceId = await workspaceOf(user.id);
    await expect(requireWorkspaceRole(app.db, user.id, workspaceId, 'EDITOR')).resolves.toBe(
      'OWNER',
    );
  });

  it('hides workspaces from non-members with 404', async () => {
    const owner = await registerUser(app);
    const outsider = await registerUser(app);
    const workspaceId = await workspaceOf(owner.user.id);
    await expect(
      requireWorkspaceRole(app.db, outsider.user.id, workspaceId, 'VIEWER'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects members below the required role with 403', async () => {
    const owner = await registerUser(app);
    const viewer = await registerUser(app);
    const workspaceId = await workspaceOf(owner.user.id);
    await app.db.workspaceMember.create({
      data: { workspaceId, userId: viewer.user.id, role: 'VIEWER' },
    });
    await expect(
      requireWorkspaceRole(app.db, viewer.user.id, workspaceId, 'EDITOR'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
