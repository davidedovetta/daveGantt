import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../test/helpers.js';
import type { App } from '../app.js';

describe('GET /health', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the database as up', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', database: 'up' });
  });
});
