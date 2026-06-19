import { Prisma } from '../../generated/prisma/client.js';

const unavailablePrismaErrorCodes = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
]);

const unavailableDriverErrorCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);

type ErrorWithCode = {
  code?: unknown;
  cause?: unknown;
};

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return unavailablePrismaErrorCodes.has(error.code);
  }

  if (isErrorWithCode(error)) {
    if (
      typeof error.code === 'string' &&
      unavailableDriverErrorCodes.has(error.code)
    ) {
      return true;
    }

    return isDatabaseUnavailableError(error.cause);
  }

  return false;
}

function isErrorWithCode(error: unknown): error is ErrorWithCode {
  return typeof error === 'object' && error !== null;
}
