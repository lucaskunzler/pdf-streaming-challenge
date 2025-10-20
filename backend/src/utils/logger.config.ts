import { FastifyInstance } from 'fastify';

/**
 * Creates logger configuration for Fastify
 */
export function createLoggerConfig(usePrettyLogs: boolean = true) {
  if (!usePrettyLogs) {
    return true; // Use default JSON logging in production
  }

  return {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
        colorize: true,
        singleLine: false,
        levelFirst: true
      }
    },
    serializers: {
      req(req: any) {
        return {
          method: req.method,
          url: req.url,
          host: req.headers?.host,
          remoteAddress: req.socket?.remoteAddress
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode
        };
      }
    }
  };
}

/**
 * Sets up custom request/response logging hooks with colored output and icons
 */
export function setupRequestLogging(app: FastifyInstance): void {
  // Log incoming requests
  app.addHook('onRequest', async (request) => {
    request.log.info(`→ ${request.method} ${request.url}`);
  });
  
  // Log completed requests with status-based icons and colors
  app.addHook('onResponse', async (request, reply) => {
    const responseTime = reply.elapsedTime.toFixed(2);
    const status = reply.statusCode;
    
    // Determine icon and log level based on status code
    let statusIcon = '✓';
    let logLevel = 'info';
    
    if (status >= 300 && status < 400) {
      statusIcon = '↻'; // Redirect
    } else if (status >= 400 && status < 500) {
      statusIcon = '⚠'; // Client error
      logLevel = 'warn';
    } else if (status >= 500) {
      statusIcon = '✗'; // Server error
      logLevel = 'error';
    }
    
    const logFn = (request.log as any)[logLevel];
    logFn.call(request.log, 
      `${statusIcon} ${request.method} ${request.url} → ${status} (${responseTime}ms)`
    );
  });
}

