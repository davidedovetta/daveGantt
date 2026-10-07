import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Email non valida' }).max(254));

export const registerInputSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1, 'Il nome è obbligatorio').max(100),
  password: z
    .string()
    .min(8, 'La password deve avere almeno 8 caratteri')
    .max(200, 'La password è troppo lunga'),
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La password è obbligatoria').max(200),
});

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
});

export const meResponseSchema = z.object({ user: userSchema });

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type User = z.infer<typeof userSchema>;
