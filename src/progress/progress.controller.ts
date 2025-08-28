import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  UseGuards, 
  Request,
  Param,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressService } from './progress.service';
import { CompleteLessonDto } from './dto/complete-lesson.dto';

@Controller('api/v1/progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private progressService: ProgressService) {}

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async completeLesson(@Request() req: any, @Body() completeLessonDto: CompleteLessonDto) {
    const userId = req.user.userId;
    return await this.progressService.completeLesson(userId, completeLessonDto);
  }

  @Get()
  async getUserProgress(@Request() req: any) {
    const userId = req.user.userId;
    return await this.progressService.getUserProgress(userId);
  }

  @Get('lesson/:lessonId')
  async getLessonProgress(@Request() req: any, @Param('lessonId') lessonId: string) {
    const userId = req.user.userId;
    return await this.progressService.getLessonProgress(userId, lessonId);
  }
}
