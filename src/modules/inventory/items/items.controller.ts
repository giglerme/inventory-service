import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UuidParam } from '../../../common/decorators/uuid-param.decorator.js';
import type { AuthenticatedUser } from '../../auth/authenticated-user.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { ListItemsQueryDto } from './dto/list-items-query.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import { ItemsService } from './items.service.js';

@Controller('internal/inventory/items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  list(
    @CurrentUser()
    user: AuthenticatedUser,

    @Query()
    query: ListItemsQueryDto,
  ) {
    return this.itemsService.list(user.sub, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser()
    user: AuthenticatedUser,

    @UuidParam('id')
    itemId: string,
  ) {
    return this.itemsService.findOne(user.sub, itemId);
  }

  @Post()
  create(
    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: CreateItemDto,
  ) {
    return this.itemsService.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser()
    user: AuthenticatedUser,

    @UuidParam('id')
    itemId: string,

    @Body()
    dto: UpdateItemDto,
  ) {
    return this.itemsService.update(user.sub, itemId, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser()
    user: AuthenticatedUser,

    @UuidParam('id')
    itemId: string,
  ) {
    return this.itemsService.remove(user.sub, itemId);
  }
}
