import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { JwtTokenService } from './jwt-token.service.js';

describe('JwtTokenService', () => {
  const previousEnv = {
    AUTH_JWKS_URL: process.env.AUTH_JWKS_URL,
    AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
    AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
    AUTH_JWT_PUBLIC_KEY_PEM: process.env.AUTH_JWT_PUBLIC_KEY_PEM,
  };

  let server: Server | undefined;
  let privateKey: CryptoKey;

  beforeEach(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;

    const publicJwk = await exportJWK(keyPair.publicKey);
    publicJwk.kid = 'test-key';
    publicJwk.alg = 'RS256';
    publicJwk.use = 'sig';

    server = await startJwksServer(publicJwk);

    process.env.AUTH_JWKS_URL = getJwksUrl(server);
    process.env.AUTH_JWT_ISSUER = 'auth-service';
    process.env.AUTH_JWT_AUDIENCE = 'food-wise-api';
    delete process.env.AUTH_JWT_PUBLIC_KEY_PEM;
  });

  afterEach(async () => {
    await stopServer(server);
    server = undefined;

    restoreEnv('AUTH_JWKS_URL', previousEnv.AUTH_JWKS_URL);
    restoreEnv('AUTH_JWT_ISSUER', previousEnv.AUTH_JWT_ISSUER);
    restoreEnv('AUTH_JWT_AUDIENCE', previousEnv.AUTH_JWT_AUDIENCE);
    restoreEnv('AUTH_JWT_PUBLIC_KEY_PEM', previousEnv.AUTH_JWT_PUBLIC_KEY_PEM);
  });

  it('validates a RS256 JWT using JWKS and returns the authenticated user', async () => {
    const service = new JwtTokenService();
    const token = await signToken(privateKey);

    await expect(service.verify(token)).resolves.toMatchObject({
      sub: '7e9cb3d8-a047-4237-af9f-dd0855fe5e7f',
      email: 'user@example.com',
      roles: ['USER'],
      issuer: 'auth-service',
      audience: 'food-wise-api',
      kid: 'test-key',
    });
  });

  it('prefers JWKS when a public key PEM env var also exists', async () => {
    process.env.AUTH_JWT_PUBLIC_KEY_PEM = 'not-a-valid-pem';

    const service = new JwtTokenService();
    const token = await signToken(privateKey);

    await expect(service.verify(token)).resolves.toMatchObject({
      sub: '7e9cb3d8-a047-4237-af9f-dd0855fe5e7f',
      kid: 'test-key',
    });
  });

  it('rejects an invalid JWT', async () => {
    const service = new JwtTokenService();

    await expect(service.verify('invalid-token')).rejects.toThrow();
  });

  async function signToken(key: CryptoKey) {
    return new SignJWT({
      email: 'user@example.com',
      roles: ['USER'],
    })
      .setProtectedHeader({
        alg: 'RS256',
        kid: 'test-key',
      })
      .setSubject('7e9cb3d8-a047-4237-af9f-dd0855fe5e7f')
      .setIssuer('auth-service')
      .setAudience('food-wise-api')
      .setExpirationTime('5m')
      .sign(key);
  }

  function startJwksServer(jwk: JWK) {
    return new Promise<Server>((resolve) => {
      const httpServer = createServer((request, response) => {
        if (request.url !== '/.well-known/jwks.json') {
          response.writeHead(404);
          response.end();

          return;
        }

        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ keys: [jwk] }));
      });

      httpServer.listen(0, '127.0.0.1', () => resolve(httpServer));
    });
  }

  function getJwksUrl(httpServer: Server) {
    const address = httpServer.address() as AddressInfo;

    return `http://127.0.0.1:${address.port}/.well-known/jwks.json`;
  }

  function stopServer(httpServer?: Server) {
    return new Promise<void>((resolve, reject) => {
      if (!httpServer?.listening) {
        resolve();

        return;
      }

      httpServer.close((error) => {
        if (error) {
          reject(error);

          return;
        }

        resolve();
      });
    });
  }

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[name];

      return;
    }

    process.env[name] = value;
  }
});
