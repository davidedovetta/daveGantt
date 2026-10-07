import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts a valid payload', () => {
    expect(healthResponseSchema.parse({ status: 'ok', database: 'up' })).toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('rejects an unknown status', () => {
    expect(() => healthResponseSchema.parse({ status: 'broken', database: 'up' })).toThrow();
  });
});
