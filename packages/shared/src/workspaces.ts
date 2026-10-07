import { z } from 'zod';

export const roleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);

export const workspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: roleSchema,
});

export const workspaceListSchema = z.array(workspaceSchema);

export const createWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1, 'Il nome è obbligatorio').max(100),
});

export type Role = z.infer<typeof roleSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;

const ROLE_RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

/** Role hierarchy OWNER > EDITOR > VIEWER (UI hints; the API enforces permissions itself). */
export const hasMinRole = (role: Role, minRole: Role) => ROLE_RANK[role] >= ROLE_RANK[minRole];
