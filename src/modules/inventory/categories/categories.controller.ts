import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UuidParam } from '../../../common/decorators/uuid-param.decorator.js';
import type { AuthenticatedUser } from '../../auth/authenticated-user.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Controller('internal/inventory/categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.categoriesService.list(user.sub);
  }

  @Post()
  create(
    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser()
    user: AuthenticatedUser,

    @UuidParam('id')
    categoryId: string,

    @Body()
    dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user.sub, categoryId, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser()
    user: AuthenticatedUser,

    @UuidParam('id')
    categoryId: string,
  ) {
    return this.categoriesService.remove(user.sub, categoryId);
  }
}
