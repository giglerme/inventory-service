import type { Request } from 'express';
import type { AuthenticatedUser } from '../../modules/auth/authenticated-user.js';

export type RequestWithContext = Request & {
  requestId?: string;
  requestStartedAt?: number;
  user?: AuthenticatedUser;
  userId?: string;
};

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
