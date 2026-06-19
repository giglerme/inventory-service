import {
  createParamDecorator,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';
import type { RequestWithContext } from '../http/request-context.js';
import { uuidPattern } from '../http/request-context.js';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<RequestWithContext>();

    const userId = request.user?.sub;

    if (typeof userId !== 'string' || !uuidPattern.test(userId)) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Usuario autenticado deve ter sub UUID valido',
        HttpStatus.BAD_REQUEST,
      );
    }

    return userId;
  },
);
