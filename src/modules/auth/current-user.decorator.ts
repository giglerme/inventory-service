import {
  createParamDecorator,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { RequestWithContext } from '../../common/http/request-context.js';
import type { AuthenticatedUser } from './authenticated-user.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithContext>();

    if (!request.user) {
      throw new AppException(
        ErrorCode.AUTH_UNAUTHORIZED,
        'Sessao invalida ou expirada.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return request.user;
  },
);
