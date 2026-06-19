import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes.js';
import { ErrorCode as ErrorCodes } from './error-codes.js';

export type ApiErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
  currentItem?: unknown;
};

export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    readonly details?: unknown,
  ) {
    super(
      {
        statusCode,
        code,
        message,
        details,
      },
      statusCode,
    );
  }
}

export class InventoryDatabaseUnavailableException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      ErrorCodes.INVENTORY_DATABASE_UNAVAILABLE,
      'Banco de dados do servico de inventario indisponivel',
      HttpStatus.SERVICE_UNAVAILABLE,
      details,
    );
  }
}
