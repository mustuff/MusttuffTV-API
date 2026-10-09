import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.article.findMany({
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        country: true,
        category: true,
        media: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(createArticleDto: CreateArticleDto) {
    return this.prisma.article.create({
      data: createArticleDto,
    });
  }

  async update(id: string, updateArticleDto: UpdateArticleDto) {
    return this.prisma.article.update({
      where: {
        id,
      },
      data: updateArticleDto,
    });
  }
}
