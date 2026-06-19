import { Controller, Get, HttpCode } from '@nestjs/common';
import { InventoryDatabaseUnavailableException } from '../../../common/errors/app.exception.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  private readonly serviceName =
    process.env.SERVICE_NAME ?? 'inventory-service';

  constructor(private readonly prisma: PrismaService) {}

  @Get('liveness')
  @HttpCode(200)
  liveness() {
    return {
      status: 'ok',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  @HttpCode(200)
  async readiness() {
    try {
      await this.withTimeout(
        this.prisma.$queryRaw`
          SELECT 1
        `,
        1_500,
      );
    } catch {
      throw new InventoryDatabaseUnavailableException({
        checks: {
          database: 'down',
        },
      });
    }

    return {
      status: 'ready',
      service: this.serviceName,
      checks: {
        database: 'up',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private withTimeout<T>(operation: Promise<T>, timeoutMs: number) {
    let timeout: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new Error('readiness timeout'));
      }, timeoutMs);
    });

    return Promise.race([operation, timeoutPromise]).finally(() => {
      clearTimeout(timeout);
    });
  }
}
