import { describe, expect, it } from 'vitest';
import { loginInputSchema, registerInputSchema } from './auth.js';

describe('registerInputSchema', () => {
  it('normalizes email and trims name', () => {
    const parsed = registerInputSchema.parse({
      email: '  Mario.Rossi@Example.COM ',
      name: '  Mario  ',
      password: 'longenough',
    });
    expect(parsed).toEqual({
      email: 'mario.rossi@example.com',
      name: 'Mario',
      password: 'longenough',
    });
  });

  it('rejects short passwords and invalid emails', () => {
    expect(
      registerInputSchema.safeParse({ email: 'a@b.it', name: 'A', password: 'short' }).success,
    ).toBe(false);
    expect(
      registerInputSchema.safeParse({ email: 'nope', name: 'A', password: 'longenough' }).success,
    ).toBe(false);
  });
});

describe('loginInputSchema', () => {
  it('normalizes email', () => {
    expect(loginInputSchema.parse({ email: 'A@B.IT', password: 'x' }).email).toBe('a@b.it');
  });
});
