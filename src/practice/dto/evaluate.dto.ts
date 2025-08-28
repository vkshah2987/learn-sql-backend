import { IsString, IsUUID, IsEnum } from 'class-validator';

export enum EvaluationMode {
  EVALUATE = 'evaluate',
  EXPLAIN = 'explain',
}

export class EvaluateDto {
  @IsUUID()
  exerciseId: string;

  @IsString()
  sql: string;

  @IsEnum(EvaluationMode)
  mode: EvaluationMode;
}
