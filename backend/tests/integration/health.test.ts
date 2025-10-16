import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';

describe('Health Endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 status with health information', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String)
    });

    // Verify timestamp is a valid ISO string
    expect(() => new Date(body.timestamp)).not.toThrow();
  });
});
