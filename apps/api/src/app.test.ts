import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../test/helpers.js';
import type { App } from './app.js';

describe('production layout (API under /api + web app)', () => {
  let app: App;

  beforeAll(async () => {
    const dist = mkdtempSync(join(tmpdir(), 'davegantt-dist-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>daveGantt</title>');
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
    app = await buildTestApp({ apiPrefix: '/api', webDistDir: dist });
  });
  afterAll(async () => {
    await app.close();
  });

  it('serves the API under the prefix', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.json()).toEqual({ status: 'ok', database: 'up' });
  });

  it('serves the SPA for client-side routes and caches fingerprinted assets', async () => {
    const page = await app.inject({ method: 'GET', url: '/p/some-project' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('<title>daveGantt</title>');
    expect(page.headers['cache-control']).toBe('no-cache');
    expect(page.headers['content-security-policy']).toContain("default-src 'self'");

    const asset = await app.inject({ method: 'GET', url: '/assets/app-abc123.js' });
    expect(asset.headers['cache-control']).toContain('immutable');
  });

  it('keeps JSON 404s for unknown API routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
