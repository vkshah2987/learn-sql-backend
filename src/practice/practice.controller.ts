import { Controller, Post, Get, Body, UseGuards, Request, Query } from '@nestjs/common';
import { PracticeService } from './practice.service';
import { EvaluateDto } from './dto/evaluate.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/practice')
@UseGuards(JwtAuthGuard)
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Post('evaluate')
  async evaluateSubmission(@Request() req: any, @Body() evaluateDto: EvaluateDto) {
    const userId = req.user?.userId; // Use userId from JWT strategy
    console.log('JWT User payload:', req.user); // Debug logging
    console.log('Extracted userId:', userId); // Debug logging
    
    if (!userId) {
      throw new Error('User ID not found in JWT token');
    }
    
    return await this.practiceService.evaluateSubmission(userId, evaluateDto);
  }

  @Get('attempts')
  async getUserAttempts(
    @Request() req: any,
    @Query('exerciseId') exerciseId?: string,
  ) {
    const userId = req.user?.userId; // Use userId from JWT strategy
    
    if (!userId) {
      throw new Error('User ID not found in JWT token');
    }
    
    return await this.practiceService.getUserAttempts(userId, exerciseId);
  }
}
