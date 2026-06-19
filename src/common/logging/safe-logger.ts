import { Logger } from '@nestjs/common';

type SafeErrorLog = {
  service: 'inventory-service';
  requestId?: string;
  route?: string;
  method?: string;
  statusCode: number;
  errorCode: string;
  validationFields?: Array<{
    field: string;
    constraints: string[];
  }>;
  durationMs?: number;
  userId?: string;
  occurredAt: string;
};

type SafeRequestLog = {
  service: 'inventory-service';
  requestId?: string;
  route?: string;
  method?: string;
  statusCode: number;
  durationMs?: number;
  userId?: string;
  occurredAt: string;
};

const logger = new Logger('inventory-service');

export function logSafeError(payload: SafeErrorLog) {
  logger.error(JSON.stringify(payload));
}

export function logSafeRequest(payload: SafeRequestLog) {
  logger.log(JSON.stringify(payload));
}
