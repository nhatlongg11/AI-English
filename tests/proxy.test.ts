import { afterEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { testConfig } from './helpers.js';

describe('deployment proxy rate limits', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  afterEach(async () => { await app?.close(); });

  async function setup(trustProxy = '') {
    // This probe exercises Fastify routing/rate limiting without database access.
    app = await buildApp({ db: {} as PrismaClient, config: testConfig({ TRUST_PROXY: trustProxy }) });
    app.get('/proxy-probe', { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } },
      async req => ({ ip: req.ip }));
    await app.ready();
    return (remoteAddress: string, forwardedFor: string) => app!.inject({
      url: '/proxy-probe', remoteAddress, headers: { 'x-forwarded-for': forwardedFor },
    });
  }

  it('keeps separate rate limits for visitors behind the internal proxy', async () => {
    const request = await setup('uniquelocal');
    const first = await request('172.20.0.2', '198.51.100.1');
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ ip: '198.51.100.1' });
    expect((await request('172.20.0.2', '198.51.100.1')).statusCode).toBe(429);
    expect((await request('172.20.0.2', '198.51.100.2')).statusCode).toBe(200);
  });

  it('rejects forwarded-IP spoofing by an untrusted direct client', async () => {
    const request = await setup('uniquelocal');
    expect((await request('203.0.113.1', '198.51.100.1')).json()).toEqual({ ip: '203.0.113.1' });
    expect((await request('203.0.113.1', '198.51.100.2')).statusCode).toBe(429);
  });

  it('ignores forwarded headers by default in local development', async () => {
    const request = await setup();
    expect((await request('127.0.0.1', '198.51.100.1')).json()).toEqual({ ip: '127.0.0.1' });
    expect((await request('127.0.0.1', '198.51.100.2')).statusCode).toBe(429);
  });
});
