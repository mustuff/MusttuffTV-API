
import { Test, TestingModule } from '@nestjs/testing';
import { LiveStreamsService } from './live-streams.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LiveStreamsService', () => {
  let service: LiveStreamsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveStreamsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LiveStreamsService>(LiveStreamsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
