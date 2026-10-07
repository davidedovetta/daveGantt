import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 defaults to argon2id (m=19456, t=2, p=1), the OWASP baseline.
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

let dummyHash: Promise<string> | undefined;

/** Burns the same time as a real check, so unknown emails are not revealed by response timing. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hash('dummy-password-for-timing');
  await verify(await dummyHash, password);
}
