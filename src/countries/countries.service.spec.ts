import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CountriesService } from './countries.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CountriesService', () => {
  let service: CountriesService;

  const prismaMock = {
    country: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountriesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CountriesService>(CountriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return countries ordered alphabetically by name', async () => {
    const countries = [
      { id: 'country-1', name: 'Kenya', code: 'KE' },
      { id: 'country-2', name: 'Sudan', code: 'SD' },
    ];

    prismaMock.country.findMany.mockResolvedValue(countries);

    await expect(service.findAll()).resolves.toEqual(countries);

    expect(prismaMock.country.findMany).toHaveBeenCalledWith({
      orderBy: {
        name: 'asc',
      },
    });
  });

  it('should create a country using the supplied data', async () => {
    const countryData = {
      name: 'Uganda',
      code: 'UG',
    };

    const createdCountry = {
      id: 'country-3',
      ...countryData,
    };

    prismaMock.country.create.mockResolvedValue(createdCountry);

    await expect(service.create(countryData)).resolves.toEqual(
      createdCountry,
    );

    expect(prismaMock.country.create).toHaveBeenCalledWith({
      data: countryData,
    });
  });
});
