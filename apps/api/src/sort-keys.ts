import { generateKeyBetween } from 'fractional-indexing';

/** Fractional-index keys must be compared byte-wise (database collations may disagree). */
export const compareKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Key that places an item right after `afterKey` among `siblingKeys`
 * (`null` = first, `undefined` = last).
 */
export function keyAfter(siblingKeys: string[], afterKey: string | null | undefined): string {
  const sorted = [...siblingKeys].sort(compareKeys);
  if (afterKey === undefined) return generateKeyBetween(sorted.at(-1) ?? null, null);
  if (afterKey === null) return generateKeyBetween(null, sorted[0] ?? null);
  const next = sorted.find((k) => compareKeys(k, afterKey) > 0) ?? null;
  return generateKeyBetween(afterKey, next);
}
