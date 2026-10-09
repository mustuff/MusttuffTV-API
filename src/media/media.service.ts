import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaType } from '../../generated/prisma/enums';

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.media.findMany({
      include: {
        article: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByArticle(articleId: string) {
    return this.prisma.media.findMany({
      where: {
        articleId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(
    type: MediaType,
    url: string,
    articleId: string,
    caption?: string,
  ) {
    return this.prisma.media.create({
      data: {
        type,
        url,
        articleId,
        caption,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.media.delete({
      where: {
        id,
      },
    });
  }
}
