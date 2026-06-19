import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { StorageModule } from './infra/storage/storage.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/inventory/health/health.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    StorageModule,
    HealthModule,
    InventoryModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
