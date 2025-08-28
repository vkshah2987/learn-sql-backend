import { IsUUID, IsInt, Min, IsOptional } from 'class-validator';

export class CompleteLessonDto {
  @IsUUID()
  lessonId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  scoreDelta?: number = 0;
}
