import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { isDatabaseUnavailableError } from '../../infra/prisma/database-error.js';
import {
  AppException,
  type ApiErrorResponse,
} from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';
import type { RequestWithContext } from '../http/request-context.js';
import { logSafeError } from '../logging/safe-logger.js';

type ErrorShape = {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  details?: unknown;
};

type SanitizedDetails =
  | string
  | number
  | boolean
  | null
  | undefined
  | SanitizedDetails[]
  | { [key: string]: SanitizedDetails };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const statusCode = this.getStatusCode(exception);
    const errorShape = this.getErrorShape(exception, statusCode);
    const body: ApiErrorResponse = {
      statusCode,
      code: errorShape.code ?? ErrorCode.INVENTORY_INTERNAL_ERROR,
      message:
        typeof errorShape.message === 'string'
          ? errorShape.message
          : 'Erro interno do inventory-service',
      requestId: request.requestId,
    };

    if (errorShape.details !== undefined) {
      body.details = this.sanitizeDetails(errorShape.details);

      if (
        this.isRecord(errorShape.details) &&
        'currentItem' in errorShape.details
      ) {
        body.currentItem = this.sanitizeDetails(errorShape.details.currentItem);
      }
    }

    logSafeError({
      service: 'inventory-service',
      requestId: request.requestId,
      route: request.path,
      method: request.method,
      statusCode,
      errorCode: body.code,
      validationFields: this.getValidationFields(body.details),
      durationMs:
        request.requestStartedAt !== undefined
          ? Date.now() - request.requestStartedAt
          : undefined,
      userId: request.userId,
      occurredAt: new Date().toISOString(),
    });

    response.status(statusCode).json(body);
  }

  private getStatusCode(exception: unknown) {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (isDatabaseUnavailableError(exception)) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        return HttpStatus.NOT_FOUND;
      }

      if (exception.code === 'P2002') {
        return HttpStatus.CONFLICT;
      }
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorShape(exception: unknown, statusCode: number): ErrorShape {
    if (exception instanceof AppException) {
      return {
        statusCode,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (isDatabaseUnavailableError(exception)) {
      return {
        statusCode,
        code: ErrorCode.INVENTORY_DATABASE_UNAVAILABLE,
        message: 'Banco de dados indisponivel',
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.getPrismaKnownErrorShape(exception, statusCode);
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          statusCode,
          code: this.codeFromStatus(statusCode),
          message: response,
        };
      }

      const shape = response as ErrorShape;

      return {
        statusCode,
        code: shape.code ?? this.codeFromStatus(statusCode),
        message: Array.isArray(shape.message)
          ? 'Payload invalido'
          : (shape.message ?? exception.message),
        details: Array.isArray(shape.message) ? shape.message : shape.details,
      };
    }

    return {
      statusCode,
      code: ErrorCode.INVENTORY_INTERNAL_ERROR,
      message: 'Erro interno do inventory-service',
    };
  }

  private codeFromStatus(statusCode: number) {
    if (statusCode === 400) {
      return ErrorCode.VALIDATION_ERROR;
    }

    if (statusCode === 401) {
      return ErrorCode.INTERNAL_AUTH_FAILED;
    }

    return ErrorCode.INVENTORY_INTERNAL_ERROR;
  }

  private getPrismaKnownErrorShape(
    exception: Prisma.PrismaClientKnownRequestError,
    statusCode: number,
  ): ErrorShape {
    if (exception.code === 'P2025') {
      return {
        statusCode,
        code: ErrorCode.INVENTORY_RECORD_NOT_FOUND,
        message: 'Registro nao encontrado',
      };
    }

    if (exception.code === 'P2002') {
      return {
        statusCode,
        code: ErrorCode.INVENTORY_RECORD_CONFLICT,
        message: 'Registro duplicado',
      };
    }

    return {
      statusCode,
      code: ErrorCode.INVENTORY_INTERNAL_ERROR,
      message: 'Erro interno do inventory-service',
    };
  }

  private sanitizeDetails(details: unknown): SanitizedDetails {
    if (Array.isArray(details)) {
      const values = details as unknown[];

      return values.map((detail) => this.sanitizeDetails(detail));
    }

    if (typeof details === 'string') {
      return details.slice(0, 200);
    }

    if (
      typeof details === 'number' ||
      typeof details === 'boolean' ||
      details === null
    ) {
      return details;
    }

    if (details instanceof Date) {
      return details.toISOString();
    }

    if (this.hasToJson(details)) {
      const jsonValue = details.toJSON();

      if (jsonValue !== details) {
        return this.sanitizeDetails(jsonValue);
      }
    }

    if (this.isRecord(details)) {
      const sanitized: { [key: string]: SanitizedDetails } = {};

      for (const [key, value] of Object.entries(details)) {
        sanitized[key] = this.isSensitiveKey(key)
          ? '[redacted]'
          : this.sanitizeDetails(value);
      }

      return sanitized;
    }

    return undefined;
  }

  private getValidationFields(details: unknown) {
    if (!this.isRecord(details) || !Array.isArray(details.fields)) {
      return undefined;
    }

    return details.fields.flatMap((field) => {
      if (!this.isRecord(field) || typeof field.field !== 'string') {
        return [];
      }

      return [
        {
          field: field.field,
          constraints: Array.isArray(field.constraints)
            ? field.constraints.filter(
                (constraint): constraint is string =>
                  typeof constraint === 'string',
              )
            : [],
        },
      ];
    });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hasToJson(value: unknown): value is { toJSON: () => unknown } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'toJSON' in value &&
      typeof value.toJSON === 'function'
    );
  }

  private isSensitiveKey(key: string) {
    return /(password|secret|token|key|url|credential)/i.test(key);
  }
}
