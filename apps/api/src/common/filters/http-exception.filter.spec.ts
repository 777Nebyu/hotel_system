import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockLogger: { warn: jest.Mock; error: jest.Mock };
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    filter = new HttpExceptionFilter(mockLogger as any);

    mockResponse = {
      headersSent: false,
      getHeader: jest.fn().mockReturnValue(undefined),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/api/v1/test',
      method: 'POST',
      headers: {},
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should format a standard NotFoundException (404)', () => {
    const exception = new NotFoundException('Hotel not found');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        path: '/api/v1/test',
        error: {
          code: 'NOT_FOUND',
          message: 'Hotel not found',
          details: null,
        },
      }),
    );
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should format a ConflictException (409)', () => {
    const exception = new ConflictException('Room already booked');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        path: '/api/v1/test',
        error: {
          code: 'CONFLICT',
          message: 'Room already booked',
          details: null,
        },
      }),
    );
  });

  it('should format a validation BadRequestException with issues array', () => {
    const issues = [{ path: ['email'], message: 'Invalid email address' }];
    const exception = new BadRequestException({
      message: 'Validation failed',
      issues,
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        path: '/api/v1/test',
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          details: issues,
        },
      }),
    );
  });

  it('should format a native ZodError (400)', () => {
    const schema = z.object({ age: z.number() });
    let zodError: any;
    try {
      schema.parse({ age: 'invalid' });
    } catch (e) {
      zodError = e;
    }

    filter.catch(zodError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        path: '/api/v1/test',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: expect.any(Array),
        },
      }),
    );
  });

  it('should format an unhandled Error (500)', () => {
    const exception = new Error('Database connection lost');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        path: '/api/v1/test',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: expect.stringMatching(/Database connection lost|Internal server error/),
          details: null,
        },
      }),
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should propagate correlation ID from request headers to response header', () => {
    mockRequest.headers['x-request-id'] = 'req-12345';
    const exception = new NotFoundException('Not found');

    filter.catch(exception, mockHost);

    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-12345');
  });
});
