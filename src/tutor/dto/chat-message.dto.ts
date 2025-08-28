import { IsString, IsObject, IsOptional, IsUUID, MaxLength } from 'class-validator';

class ChatContextDto {
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  lastSql?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  currentTopic?: string;
}

export class ChatMessageDto {
  @IsString()
  @MaxLength(1000)
  message: string;

  @IsOptional()
  @IsObject()
  context?: ChatContextDto;
}
