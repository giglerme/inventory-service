import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CategoryScope, Prisma } from '../../../generated/prisma/client.js';
import { AppException } from '../../../common/errors/app.exception.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { normalizeText } from '../../../common/utils/normalize-text.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const startedAt = Date.now();

    const categories = await this.prisma.inventoryCategory.findMany({
      where: {
        isActive: true,

        OR: [
          {
            scope: CategoryScope.SYSTEM,

            ownerUserId: null,
          },

          {
            scope: CategoryScope.USER,

            ownerUserId: userId,
          },
        ],
      },

      orderBy: [
        {
          sortOrder: 'asc',
        },

        {
          name: 'asc',
        },
      ],
    });

    this.logger.log({
      event: 'inventory.categories.list.completed',
      userId,
      count: categories.length,
      prismaQueryDurationMs: Date.now() - startedAt,
    });

    return categories;
  }

  async create(userId: string, dto: CreateCategoryDto) {
    const normalizedName = normalizeText(dto.name);

    const existing = await this.prisma.inventoryCategory.findFirst({
      where: {
        ownerUserId: userId,

        normalizedName,

        scope: CategoryScope.USER,
      },
    });

    if (existing) {
      throw this.categoryAlreadyExists();
    }

    try {
      return await this.prisma.inventoryCategory.create({
        data: {
          ownerUserId: userId,

          scope: CategoryScope.USER,

          systemCode: null,

          name: dto.name.trim(),

          normalizedName,

          icon: dto.icon,

          color: dto.color,

          isActive: true,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw this.categoryAlreadyExists();
      }

      throw error;
    }
  }

  async update(userId: string, categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.findOwnedUserCategory(userId, categoryId);

    const normalizedName = dto.name ? normalizeText(dto.name) : undefined;

    if (normalizedName) {
      const duplicate = await this.prisma.inventoryCategory.findFirst({
        where: {
          ownerUserId: userId,

          normalizedName,

          scope: CategoryScope.USER,

          id: {
            not: category.id,
          },
        },
      });

      if (duplicate) {
        throw this.categoryAlreadyExists();
      }
    }

    try {
      await this.prisma.inventoryCategory.updateMany({
        where: {
          id: category.id,

          ownerUserId: userId,

          scope: CategoryScope.USER,
        },

        data: {
          name: dto.name?.trim(),

          normalizedName,

          icon: dto.icon,

          color: dto.color,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw this.categoryAlreadyExists();
      }

      throw error;
    }

    return this.findOwnedUserCategory(userId, category.id);
  }

  async remove(userId: string, categoryId: string) {
    const category = await this.findOwnedUserCategory(userId, categoryId);

    await this.prisma.inventoryCategory.updateMany({
      where: {
        id: category.id,

        ownerUserId: userId,

        scope: CategoryScope.USER,
      },

      data: {
        isActive: false,
      },
    });

    return {
      success: true,
    };
  }

  private async findOwnedUserCategory(userId: string, categoryId: string) {
    const category = await this.prisma.inventoryCategory.findFirst({
      where: {
        id: categoryId,

        ownerUserId: userId,

        scope: CategoryScope.USER,
      },
    });

    if (!category) {
      throw new AppException(
        ErrorCode.CATEGORY_NOT_FOUND,
        'Categoria nao encontrada',
        HttpStatus.NOT_FOUND,
      );
    }

    return category;
  }

  private categoryAlreadyExists() {
    return new AppException(
      ErrorCode.CATEGORY_ALREADY_EXISTS,
      'Ja existe uma categoria personalizada com esse nome',
      HttpStatus.CONFLICT,
    );
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
