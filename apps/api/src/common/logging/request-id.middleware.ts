import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import * as winston from 'winston';
import { createLoggerOptions } from './winston.config';
import { requestContext } from '../context/request-context';

const logger = winston.createLogger(
  createLoggerOptions(process.env.NODE_ENV ?? 'development'),
);

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  const startedAt = Date.now();
  res.setHeader('X-Request-Id', requestId);
  requestContext.run({ requestId, startedAt }, () => {
    logger.info('request started', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
    res.on('finish', () => {
      logger.info('request completed', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });
}
