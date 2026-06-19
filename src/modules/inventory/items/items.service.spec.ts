import { describe, expect, it, jest } from '@jest/globals';
import { AppException } from '../../../common/errors/app.exception.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { ItemsService } from './items.service.js';

describe('ItemsService', () => {
  const userId = '7e9cb3d8-a047-4237-af9f-dd0855fe5e7f';
  const itemId = '19ed366a-514b-4db1-b190-c1c192b3aef2';

  function createService() {
    const prisma = {
      inventoryCategory: {
        findFirst: jest.fn(),
      },
      inventoryItem: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    return {
      prisma,
      service: new ItemsService(prisma as unknown as PrismaService),
    };
  }

  it('limits item listing to the default page size and orders by updatedAt desc', async () => {
    const { prisma, service } = createService();

    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await expect(service.list(userId)).resolves.toEqual([]);
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    );
  });

  it('returns ITEM_VERSION_REQUIRED when update omits expectedVersion', async () => {
    const { service } = createService();

    await expect(service.update(userId, itemId, {})).rejects.toMatchObject<
      Partial<AppException>
    >({
      code: ErrorCode.ITEM_VERSION_REQUIRED,
      message: 'Versao atual do item obrigatoria para atualizar.',
    });
  });

  it('returns ITEM_VERSION_CONFLICT with currentItem when version is stale', async () => {
    const { prisma, service } = createService();
    const currentItem = {
      id: itemId,
      userId,
      version: 2,
      updatedAt: new Date('2026-06-19T00:00:00.000Z'),
    };

    prisma.inventoryItem.findFirst
      .mockResolvedValueOnce({
        id: itemId,
        version: 2,
      })
      .mockResolvedValueOnce(currentItem);

    await expect(
      service.update(userId, itemId, {
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject<Partial<AppException>>({
      code: ErrorCode.ITEM_VERSION_CONFLICT,
      message:
        'Este item foi atualizado por outra operacao. Recarregue os dados e tente novamente.',
      details: {
        currentItem,
      },
    });
  });
});
