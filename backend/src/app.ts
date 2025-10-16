import fastify, { FastifyInstance } from 'fastify';

export function createApp(): FastifyInstance {
  const app = fastify({ logger: true });

  // Health endpoint
  app.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  });

  return app;
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  
  const start = async () => {
    try {
      await app.listen({ port: 3000, host: '0.0.0.0' });
      console.log('Server running on http://localhost:3000');
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  
  start();
}
