import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { decodeProtectedHeader } from 'jose';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { RequestWithContext } from '../../common/http/request-context.js';
import { JwtTokenService } from './jwt-token.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly jwtTokenService: JwtTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const token = this.extractToken(request);

    if (!token) {
      this.logger.warn({
        message: 'JWT token missing',
        ...this.getRequestDebugInfo(request),
        ...this.jwtTokenService.getDebugConfig(),
      });

      throw this.unauthorized();
    }

    try {
      const user = await this.jwtTokenService.verify(token);

      request.user = user;
      request.userId = user.sub;

      return true;
    } catch (error) {
      this.logger.warn({
        message: 'JWT verification failed',
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
        jwtHeader: this.safeDecodeJwtHeader(token),
        ...this.getRequestDebugInfo(request),
        ...this.jwtTokenService.getDebugConfig(),
      });

      throw this.unauthorized();
    }
  }

  private extractToken(request: RequestWithContext) {
    const authorization = request.header('authorization');

    if (authorization) {
      const [scheme, token] = authorization.split(' ');

      if (
        scheme.toLowerCase() === 'bearer' &&
        token &&
        token.trim().length > 0
      ) {
        return token.trim();
      }
    }

    return this.extractCookieToken(request);
  }

  private getCookieName() {
    return process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME?.trim() || 'fw_access';
  }

  private extractCookieToken(request: RequestWithContext) {
    const cookieName = this.getCookieName();
    const parsedCookie = request.cookies?.[cookieName];

    if (typeof parsedCookie === 'string' && parsedCookie.length > 0) {
      return parsedCookie;
    }

    const cookieHeader = request.header('cookie');

    if (!cookieHeader) {
      return undefined;
    }

    for (const cookie of cookieHeader.split(';')) {
      const [name, ...valueParts] = cookie.trim().split('=');

      if (name === cookieName) {
        const value = valueParts.join('=');

        try {
          return value ? decodeURIComponent(value) : undefined;
        } catch {
          return undefined;
        }
      }
    }

    return undefined;
  }

  private getRequestDebugInfo(request: RequestWithContext) {
    const rawCookieHeader = request.header('cookie');

    return {
      hasAuthorizationHeader: Boolean(request.header('authorization')),
      hasCookieHeader: Boolean(rawCookieHeader),
      cookieName: this.getCookieName(),
      cookieNames: this.getCookieNamesForDebug(rawCookieHeader),
    };
  }

  private getCookieNamesForDebug(rawCookieHeader?: string) {
    if (!rawCookieHeader) {
      return [];
    }

    return rawCookieHeader
      .split(';')
      .map((cookie) => cookie.trim().split('=')[0])
      .filter(Boolean);
  }

  private safeDecodeJwtHeader(token: string) {
    try {
      const protectedHeader = decodeProtectedHeader(token);

      return {
        alg: protectedHeader.alg,
        kid: protectedHeader.kid,
      };
    } catch {
      return undefined;
    }
  }

  private unauthorized() {
    return new AppException(
      ErrorCode.AUTH_UNAUTHORIZED,
      'Sessao invalida ou expirada.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
