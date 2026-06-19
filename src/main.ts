import 'dotenv/config';
import { HttpStatus, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AppException } from './common/errors/app.exception.js';
import { ErrorCode } from './common/errors/error-codes.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { getSafeDatabaseConfig } from './infra/prisma/database-config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      forbidNonWhitelisted: true,

      transform: true,

      exceptionFactory: (errors) =>
        new AppException(
          ErrorCode.VALIDATION_ERROR,
          'Dados invalidos',
          HttpStatus.BAD_REQUEST,
          {
            fields: errors.map((error) => ({
              field: error.property,
              constraints: Object.values(error.constraints ?? {}),
            })),
          },
        ),
    }),
  );

  await app.listen(Number(process.env.PORT));
}
bootstrap().catch((error: unknown) => {
  Logger.error(
    JSON.stringify({
      service: 'inventory-service',
      errorCode: ErrorCode.INVENTORY_INTERNAL_ERROR,
      message: 'Falha ao iniciar inventory-service',
      database: getSafeDatabaseConfig(),
      occurredAt: new Date().toISOString(),
    }),
  );

  void error;
  process.exit(1);
});
