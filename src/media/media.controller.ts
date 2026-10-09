import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaType } from '../../generated/prisma/enums';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  async findAll() {
    return this.mediaService.findAll();
  }

  @Get('article/:articleId')
  async findByArticle(@Param('articleId') articleId: string) {
    return this.mediaService.findByArticle(articleId);
  }

  @Post()
  async create(
    @Body()
    body: {
      type: MediaType;
      url: string;
      articleId: string;
      caption?: string;
    },
  ) {
    return this.mediaService.create(
      body.type,
      body.url,
      body.articleId,
      body.caption,
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}
