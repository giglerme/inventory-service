import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtTokenService } from './jwt-token.service.js';

@Global()
@Module({
  providers: [JwtTokenService, JwtAuthGuard],
  exports: [JwtTokenService, JwtAuthGuard],
})
export class AuthModule {}
