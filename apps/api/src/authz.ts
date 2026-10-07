import { hasMinRole, type Role } from '@davegantt/shared';
import type { Db } from './db.js';
import { forbidden, notFound } from './errors.js';

export const hasRole = hasMinRole;

/**
 * Returns the caller's role in the workspace. Non-members get 404 (existence is not
 * revealed), members below `minRole` get 403. Accepts a transaction client too.
 */
export async function requireWorkspaceRole(
  db: Pick<Db, 'workspaceMember'>,
  userId: string,
  workspaceId: string,
  minRole: Role,
): Promise<Role> {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!membership) throw notFound('Workspace');
  if (!hasRole(membership.role, minRole)) throw forbidden();
  return membership.role;
}

/**
 * Resolves an active (non-archived) project and the caller's role in its workspace.
 * Unknown, archived and not-visible projects all yield 404.
 */
export async function requireProjectRole(
  db: Pick<Db, 'project' | 'workspaceMember'>,
  userId: string,
  projectId: string,
  minRole: Role,
) {
  const project = await db.project.findFirst({ where: { id: projectId, archivedAt: null } });
  if (!project) throw notFound('Progetto');
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    select: { role: true },
  });
  if (!membership) throw notFound('Progetto');
  if (!hasRole(membership.role, minRole)) throw forbidden();
  return { project, role: membership.role };
}
