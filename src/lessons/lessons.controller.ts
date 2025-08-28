import { Controller, Get, Param, Query } from '@nestjs/common';
import { LessonsService } from './lessons.service';

@Controller('api/v1/lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  async findAll(@Query('includeDrafts') includeDrafts?: string) {
    const includeDraftsFlag = includeDrafts === 'true';
    return await this.lessonsService.findAll(includeDraftsFlag);
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return await this.lessonsService.findBySlug(slug);
  }
}
