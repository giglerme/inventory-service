import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UuidParam } from '../../../common/decorators/uuid-param.decorator.js';
import type { AuthenticatedUser } from '../../auth/authenticated-user.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PhotosService } from './photos.service.js';

@Controller('internal/inventory')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post('items/:itemId/photos')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,

        fileSize: 5_000_000,
      },
    }),
  )
  upload(
    @CurrentUser()
    user: AuthenticatedUser,

    @UuidParam('itemId')
    itemId: string,

    @UploadedFile()
    file?: Express.Multer.File,
  ) {
    return this.photosService.upload(user.sub, itemId, file);
  }

  @Get('items/:itemId/photos')
  list(
    @CurrentUser()
    user: AuthenticatedUser,

    @UuidParam('itemId')
    itemId: string,
  ) {
    return this.photosService.list(user.sub, itemId);
  }

  @Delete('items/:itemId/photos/:photoId')
  remove(
    @CurrentUser()
    user: AuthenticatedUser,

    @UuidParam('itemId')
    itemId: string,

    @UuidParam('photoId')
    photoId: string,
  ) {
    return this.photosService.remove(user.sub, itemId, photoId);
  }

  @Get('photos/:photoId/content')
  async content(
    @CurrentUser()
    user: AuthenticatedUser,

    @UuidParam('photoId')
    photoId: string,

    @Query('variant')
    variant: 'image' | 'thumbnail' = 'thumbnail',

    @Res()
    response: Response,
  ) {
    const content = await this.photosService.getContent(
      user.sub,
      photoId,
      variant,
    );

    response.setHeader('Content-Type', content.mimeType);

    response.setHeader('Cache-Control', 'no-store');

    response.send(content.buffer);
  }
}
