import { describe, expect, it, jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { RequestWithContext } from '../../common/http/request-context.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { JwtTokenService } from './jwt-token.service.js';

describe('JwtAuthGuard', () => {
  const user = {
    sub: '7e9cb3d8-a047-4237-af9f-dd0855fe5e7f',
    email: 'user@example.com',
    roles: ['USER'],
  };

  function createGuard() {
    const jwtTokenService = {
      getDebugConfig: jest.fn<JwtTokenService['getDebugConfig']>(() => ({
        jwksUrl: 'http://auth-service:3002/.well-known/jwks.json',
        issuer: 'auth-service',
        audience: 'food-wise-api',
        verifierSource: 'jwks',
      })),
      verify: jest.fn<JwtTokenService['verify']>(),
    };

    return {
      guard: new JwtAuthGuard(jwtTokenService as unknown as JwtTokenService),
      jwtTokenService,
    };
  }

  function createContext(
    headers: Record<string, string> = {},
    cookies?: Record<string, string>,
  ) {
    const request = {
      cookies,
      header: (name: string) => headers[name.toLowerCase()],
    } as RequestWithContext;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    return {
      context,
      request,
    };
  }

  it('returns AUTH_UNAUTHORIZED when the token is missing', async () => {
    const { guard } = createGuard();
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toMatchObject<
      Partial<AppException>
    >({
      code: ErrorCode.AUTH_UNAUTHORIZED,
      message: 'Sessao invalida ou expirada.',
    });
  });

  it('returns AUTH_UNAUTHORIZED when the token is invalid', async () => {
    const { guard, jwtTokenService } = createGuard();
    const { context } = createContext({
      authorization: 'Bearer invalid-token',
    });

    jwtTokenService.verify.mockRejectedValue(new Error('invalid token'));

    await expect(guard.canActivate(context)).rejects.toMatchObject<
      Partial<AppException>
    >({
      code: ErrorCode.AUTH_UNAUTHORIZED,
      message: 'Sessao invalida ou expirada.',
    });
  });

  it('accepts a valid token from Authorization Bearer and populates request.user', async () => {
    const { guard, jwtTokenService } = createGuard();
    const { context, request } = createContext({
      authorization: 'Bearer valid-token',
    });

    jwtTokenService.verify.mockResolvedValue(user);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtTokenService.verify).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual(user);
    expect(request.userId).toBe(user.sub);
  });

  it('accepts a valid token from the configured access cookie', async () => {
    const previousCookieName = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME;
    process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME = 'fw_access';

    const { guard, jwtTokenService } = createGuard();
    const { context, request } = createContext({
      cookie: 'theme=light; fw_access=cookie-token; other=value',
    });

    jwtTokenService.verify.mockResolvedValue(user);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtTokenService.verify).toHaveBeenCalledWith('cookie-token');
    expect(request.user).toEqual(user);

    if (previousCookieName === undefined) {
      delete process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME;
    } else {
      process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME = previousCookieName;
    }
  });

  it('accepts a valid token from parsed cookies', async () => {
    const previousCookieName = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME;
    process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME = 'fw_access';

    const { guard, jwtTokenService } = createGuard();
    const { context, request } = createContext(
      {},
      { fw_access: 'parsed-token' },
    );

    jwtTokenService.verify.mockResolvedValue(user);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtTokenService.verify).toHaveBeenCalledWith('parsed-token');
    expect(request.user).toEqual(user);

    if (previousCookieName === undefined) {
      delete process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME;
    } else {
      process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME = previousCookieName;
    }
  });
});
