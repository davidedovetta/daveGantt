import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db.js';

export const SESSION_COOKIE = 'dg_session';

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * DAY_MS;
const RENEW_BELOW_MS = 15 * DAY_MS;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Db, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

/**
 * Resolves a session token to its user. Expired sessions are deleted; sessions past half
 * their lifetime are extended (`renewedUntil` tells the caller to refresh the cookie).
 */
export async function resolveSession(db: Db, token: string) {
  const id = hashToken(token);
  const session = await db.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }

  let renewedUntil: Date | undefined;
  if (session.expiresAt.getTime() - now < RENEW_BELOW_MS) {
    renewedUntil = new Date(now + SESSION_TTL_MS);
    await db.session.update({ where: { id }, data: { expiresAt: renewedUntil } });
  }
  return { user: session.user, renewedUntil };
}

export async function deleteSession(db: Db, token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}
