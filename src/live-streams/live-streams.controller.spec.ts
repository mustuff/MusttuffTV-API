
import { Test, TestingModule } from '@nestjs/testing';
import { LiveStreamsController } from './live-streams.controller';
import { LiveStreamsService } from './live-streams.service';

describe('LiveStreamsController', () => {
  let controller: LiveStreamsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LiveStreamsController],
      providers: [
        {
          provide: LiveStreamsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<LiveStreamsController>(LiveStreamsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
