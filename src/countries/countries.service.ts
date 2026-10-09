import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCountryDto } from './dto/create-country.dto';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.country.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async create(createCountryDto: CreateCountryDto) {
    return this.prisma.country.create({
      data: createCountryDto,
    });
  }
}
