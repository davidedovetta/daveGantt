import type { Role } from '@davegantt/shared';
import type { Db } from './db.js';
import { forbidden, notFound } from './errors.js';

const ROLE_RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export const hasRole = (role: Role, minRole: Role) => ROLE_RANK[role] >= ROLE_RANK[minRole];

/**
 * Returns the caller's role in the workspace. Non-members get 404 (existence is not
 * revealed), members below `minRole` get 403.
 */
export async function requireWorkspaceRole(
  db: Db,
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
