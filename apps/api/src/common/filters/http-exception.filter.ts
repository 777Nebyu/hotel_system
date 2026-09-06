import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as winston from 'winston';
import { ZodError } from 'zod';
import { getRequestId } from '../context/request-context';

export interface FormattedErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  error: {
    code: string;
    message: string;
    details: any;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: winston.Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      getRequestId() ||
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      undefined;

    if (requestId && !response.headersSent && !response.getHeader('x-request-id')) {
      response.setHeader('X-Request-Id', requestId);
    }

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: any = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const statusKey = HttpStatus[statusCode];
      code = statusKey ? statusKey.toString().toUpperCase() : 'HTTP_ERROR';

      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        if (resObj.code && typeof resObj.code === 'string') {
          code = resObj.code.toUpperCase().replace(/\s+/g, '_');
        } else if (resObj.error && typeof resObj.error === 'string') {
          code = resObj.error.toUpperCase().replace(/\s+/g, '_');
        }

        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          details = resObj.message;
        } else if (resObj.issues) {
          message = typeof resObj.message === 'string' ? resObj.message : 'Validation failed';
          details = resObj.issues;
        } else if (resObj.details !== undefined) {
          message = typeof resObj.message === 'string' ? resObj.message : exception.message;
          details = resObj.details;
        } else if (resObj.errors !== undefined) {
          message = typeof resObj.message === 'string' ? resObj.message : exception.message;
          details = resObj.errors;
        } else if (typeof resObj.message === 'string') {
          message = resObj.message;
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof ZodError || (exception as any)?.name === 'ZodError') {
      statusCode = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Validation failed';
      details = (exception as any).issues || (exception as any).errors || null;
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception.message || 'Internal server error';
      details = null;
    }

    const payload: FormattedErrorResponse = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request?.url ?? '',
      error: {
        code,
        message,
        details,
      },
    };

    if (this.logger) {
      const logMessage = `[${requestId || 'no-req-id'}] ${request.method} ${request.url} ${statusCode} - ${message}`;
      if (statusCode >= 500) {
        this.logger.error(logMessage, {
          statusCode,
          path: request.url,
          method: request.method,
          requestId,
          code,
          details,
          stack: exception instanceof Error ? exception.stack : undefined,
        });
      } else {
        this.logger.warn(logMessage, {
          statusCode,
          path: request.url,
          method: request.method,
          requestId,
          code,
          details,
        });
      }
    }

    response.status(statusCode).json(payload);
  }
}
