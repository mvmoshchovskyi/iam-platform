import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ProblemExtras {
  code?: string;
  errors?: unknown;
  retryAfter?: number;
}

/** Maps every thrown error to an RFC 7807 `application/problem+json` response. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'An unexpected error occurred';
    const extras: ProblemExtras = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        detail = body;
      } else {
        const b = body as Record<string, unknown>;
        const message = b.message;
        detail = Array.isArray(message)
          ? message.join('; ')
          : typeof message === 'string'
            ? message
            : exception.message;
        if (typeof b.code === 'string') extras.code = b.code;
        if (b.errors) extras.errors = b.errors;
        if (typeof b.retryAfter === 'number') extras.retryAfter = b.retryAfter;
      }
      if (status === Number(HttpStatus.TOO_MANY_REQUESTS)) {
        extras.code ??= 'RATE_LIMITED';
        if (detail.startsWith('ThrottlerException')) detail = 'Too many requests, please slow down';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        detail = 'Resource already exists';
        extras.code = 'CONFLICT';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        detail = 'Resource not found';
        extras.code = 'NOT_FOUND';
      }
    }

    if (status >= 500) {
      this.logger.error({ err: exception, path: req.originalUrl }, 'Unhandled exception');
    }

    if (extras.retryAfter) res.setHeader('Retry-After', String(extras.retryAfter));

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `https://httpstatuses.io/${status}`,
        title: STATUS_CODES[status] ?? 'Error',
        status,
        detail,
        instance: req.originalUrl,
        traceId: req.id,
        ...extras,
      });
  }
}
