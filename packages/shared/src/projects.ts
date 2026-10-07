import { z } from 'zod';

export const PROJECT_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#64748b',
] as const;

export const projectColorSchema = z.enum(PROJECT_COLORS);

export const projectSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  name: z.string(),
  color: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const projectListSchema = z.array(projectSchema);

const projectName = z.string().trim().min(1, 'Il nome è obbligatorio').max(200);

export const createProjectInputSchema = z.object({
  name: projectName,
  color: projectColorSchema.optional(),
});

export const updateProjectInputSchema = z
  .object({ name: projectName, color: projectColorSchema })
  .partial();

export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
