import { Injectable, Logger } from '@nestjs/common';
import { StorageLocation } from '../../../generated/prisma/client.js';
import { InventoryDatabaseUnavailableException } from '../../../common/errors/app.exception.js';
import { isDatabaseUnavailableError } from '../../../infra/prisma/database-error.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const startedAt = Date.now();
    const today = this.startOfUtcDay(new Date());
    const expiringLimit = new Date(today);

    expiringLimit.setUTCDate(expiringLimit.getUTCDate() + 7);

    try {
      const [
        totalItems,
        expiredItems,
        expiringSoonItems,
        groupedLocations,
        recentItems,
        nextToExpire,
      ] = await this.loadSummaryData(userId, today, expiringLimit);

      const storageLocations = {
        fridge: {
          items: 0,
        },

        freezer: {
          items: 0,
        },

        pantry: {
          items: 0,
        },
      };

      for (const group of groupedLocations) {
        if (group.storageLocation === StorageLocation.FRIDGE) {
          storageLocations.fridge.items = group._count._all;
        }

        if (group.storageLocation === StorageLocation.FREEZER) {
          storageLocations.freezer.items = group._count._all;
        }

        if (group.storageLocation === StorageLocation.PANTRY) {
          storageLocations.pantry.items = group._count._all;
        }
      }

      const response = {
        totals: {
          items: totalItems,

          expired: expiredItems,

          expiringSoon: expiringSoonItems,
        },

        storageLocations,

        recentItems: recentItems.map(({ photos, ...item }) => ({
          ...item,

          primaryPhotoId: photos[0]?.id ?? null,
        })),

        nextToExpire: nextToExpire.map(({ photos, ...item }) => ({
          ...item,

          primaryPhotoId: photos[0]?.id ?? null,
        })),
      };

      // Temporário: permite detectar BigInt antes que a resposta chegue ao Nest.
      JSON.stringify(response);

      this.logger.log({
        event: 'inventory.dashboard.summary.completed',
        userId,
        durationMs: Date.now() - startedAt,
      });

      return response;
    } catch (error) {
      this.logger.error({
        event: 'inventory.dashboard.summary.failed',

        userId,

        error: this.serializeError(error),
      });

      if (isDatabaseUnavailableError(error)) {
        throw new InventoryDatabaseUnavailableException();
      }

      throw error;
    }
  }

  private loadSummaryData(userId: string, today: Date, expiringLimit: Date) {
    return Promise.all([
      this.traceQuery(
        'totalItems',

        this.prisma.inventoryItem.count({
          where: {
            userId,
          },
        }),
      ),

      this.traceQuery(
        'expiredItems',

        this.prisma.inventoryItem.count({
          where: {
            userId,

            expiresAt: {
              lt: today,
            },
          },
        }),
      ),

      this.traceQuery(
        'expiringSoonItems',

        this.prisma.inventoryItem.count({
          where: {
            userId,

            expiresAt: {
              gte: today,

              lte: expiringLimit,
            },
          },
        }),
      ),

      this.traceQuery(
        'groupedLocations',

        this.prisma.inventoryItem.groupBy({
          by: ['storageLocation'],

          where: {
            userId,
          },

          _count: {
            _all: true,
          },
        }),
      ),

      this.traceQuery(
        'recentItems',

        this.prisma.inventoryItem.findMany({
          where: {
            userId,
          },

          orderBy: {
            createdAt: 'desc',
          },

          take: 5,

          include: {
            photos: {
              orderBy: [
                {
                  isPrimary: 'desc',
                },

                {
                  position: 'asc',
                },
              ],

              take: 1,

              select: {
                id: true,
              },
            },
          },
        }),
      ),

      this.traceQuery(
        'nextToExpire',

        this.prisma.inventoryItem.findMany({
          where: {
            userId,

            expiresAt: {
              gte: today,
            },
          },

          orderBy: {
            expiresAt: 'asc',
          },

          take: 5,

          include: {
            photos: {
              orderBy: [
                {
                  isPrimary: 'desc',
                },

                {
                  position: 'asc',
                },
              ],

              take: 1,

              select: {
                id: true,
              },
            },
          },
        }),
      ),
    ]);
  }

  private async traceQuery<T>(query: string, operation: Promise<T>) {
    const startedAt = Date.now();

    try {
      const result = await operation;

      this.logger.log({
        event: 'inventory.dashboard.query.completed',
        query,
        durationMs: Date.now() - startedAt,
      });

      return result;
    } catch (error) {
      this.logger.error({
        event: 'inventory.dashboard.query.failed',

        query,

        error: this.serializeError(error),
      });

      throw error;
    }
  }

  private serializeError(error: unknown) {
    if (!(error instanceof Error)) {
      return {
        message: String(error),
      };
    }

    const errorWithMetadata = error as Error & {
      code?: unknown;
      meta?: unknown;
      cause?: unknown;
    };

    return {
      name: errorWithMetadata.name,

      message: errorWithMetadata.message,

      code: errorWithMetadata.code,

      meta: errorWithMetadata.meta,

      stack: errorWithMetadata.stack,

      cause:
        errorWithMetadata.cause instanceof Error
          ? {
              name: errorWithMetadata.cause.name,

              message: errorWithMetadata.cause.message,
            }
          : errorWithMetadata.cause,
    };
  }

  private startOfUtcDay(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
}
