import { Injectable } from '@nestjs/common';
import {
  createRemoteJWKSet,
  importSPKI,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import type { AuthenticatedUser } from './authenticated-user.js';

@Injectable()
export class JwtTokenService {
  private verifier?: JWTVerifyGetKey;
  private verifierSource?: 'jwks' | 'pem';

  async verify(token: string): Promise<AuthenticatedUser> {
    const { payload, protectedHeader } = await jwtVerify(
      token,
      await this.getVerifier(),
      {
        issuer: this.getRequiredEnv('AUTH_JWT_ISSUER'),
        audience: this.getRequiredEnv('AUTH_JWT_AUDIENCE'),
        algorithms: ['RS256'],
      },
    );

    return this.toAuthenticatedUser(payload, protectedHeader.kid);
  }

  getDebugConfig() {
    return {
      jwksUrl: this.getOptionalEnv('AUTH_JWKS_URL'),
      issuer: this.getOptionalEnv('AUTH_JWT_ISSUER'),
      audience: this.getOptionalEnv('AUTH_JWT_AUDIENCE'),
      verifierSource: this.verifierSource,
    };
  }

  private async getVerifier(): Promise<JWTVerifyGetKey> {
    if (this.verifier) {
      return this.verifier;
    }

    const jwksUrl = this.getOptionalEnv('AUTH_JWKS_URL');

    if (jwksUrl) {
      this.verifier = createRemoteJWKSet(new URL(jwksUrl));
      this.verifierSource = 'jwks';

      return this.verifier;
    }

    const publicKeyPem = this.getOptionalEnv('AUTH_JWT_PUBLIC_KEY_PEM');

    if (publicKeyPem) {
      const publicKey = await importSPKI(
        publicKeyPem.replace(/\\n/g, '\n'),
        'RS256',
      );

      this.verifier = () => publicKey;
      this.verifierSource = 'pem';

      return this.verifier;
    }

    throw new Error('AUTH_JWKS_URL nao configurado');
  }

  private toAuthenticatedUser(
    payload: JWTPayload,
    kid: string | undefined,
  ): AuthenticatedUser {
    if (!payload.sub) {
      throw new Error('JWT sem sub');
    }

    return {
      sub: payload.sub,
      email:
        typeof payload.email === 'string' && payload.email.length > 0
          ? payload.email
          : undefined,
      roles: this.toStringArray(payload.roles),
      issuer: payload.iss,
      audience: payload.aud,
      kid,
    };
  }

  private toStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private getRequiredEnv(name: string) {
    const value = this.getOptionalEnv(name);

    if (!value) {
      throw new Error(`${name} nao configurado`);
    }

    return value;
  }

  private getOptionalEnv(name: string) {
    return process.env[name]?.trim();
  }
}
