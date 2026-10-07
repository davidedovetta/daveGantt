import { z } from 'zod';
import { emailSchema } from './auth.js';
import { roleSchema } from './workspaces.js';

export const memberSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  role: roleSchema,
});

export const memberListSchema = z.array(memberSchema);

export const addMemberInputSchema = z.object({
  email: emailSchema,
  role: roleSchema,
});

export const updateMemberInputSchema = z.object({
  role: roleSchema,
});

export type Member = z.infer<typeof memberSchema>;
export type AddMemberInput = z.infer<typeof addMemberInputSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberInputSchema>;
