import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { RequestWithContext } from '../http/request-context.js';
import { logSafeRequest } from '../logging/safe-logger.js';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithContext, response: Response, next: NextFunction) {
    const headerValue = request.header('x-request-id')?.trim();

    request.requestId =
      headerValue && headerValue.length > 0 ? headerValue : randomUUID();

    request.requestStartedAt = Date.now();

    response.setHeader('x-request-id', request.requestId);

    if (request.path.startsWith('/internal/inventory')) {
      response.setHeader('Cache-Control', 'no-store');
    }

    response.on('finish', () => {
      logSafeRequest({
        service: 'inventory-service',
        requestId: request.requestId,
        route: request.path,
        method: request.method,
        statusCode: response.statusCode,
        durationMs:
          request.requestStartedAt !== undefined
            ? Date.now() - request.requestStartedAt
            : undefined,
        userId: request.userId,
        occurredAt: new Date().toISOString(),
      });
    });

    next();
  }
}
