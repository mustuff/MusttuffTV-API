import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { LiveStreamsService } from './live-streams.service';

@Controller('live-streams')
export class LiveStreamsController {
  constructor(
    private readonly liveStreamsService: LiveStreamsService,
  ) {}

  @Get()
  async findAll() {
    return this.liveStreamsService.findAll();
  }

  @Get('live')
  async findLive() {
    return this.liveStreamsService.findLive();
  }

  @Post()
  async create(
    @Body()
    body: {
      title: string;
      description?: string;
      streamUrl?: string;
    },
  ) {
    return this.liveStreamsService.create(
      body.title,
      body.description,
      body.streamUrl,
    );
  }

  @Patch(':id/start')
  async start(@Param('id') id: string) {
    return this.liveStreamsService.start(id);
  }

  @Patch(':id/end')
  async end(@Param('id') id: string) {
    return this.liveStreamsService.end(id);
  }
}
