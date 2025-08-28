import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TutorService } from './tutor.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@Controller('api/v1/tutor')
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private tutorService: TutorService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Request() req: any, @Body() chatMessageDto: ChatMessageDto) {
    const userId = req.user.userId;
    return await this.tutorService.chat(userId, chatMessageDto);
  }
}
