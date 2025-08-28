import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidatorService } from '../validator/validator.service';
import { AIService } from '../ai/ai.service';
import { EvaluateDto, EvaluationMode } from './dto/evaluate.dto';

export interface EvaluationResult {
  isCorrect: boolean;
  feedback: string;
  resultPreview?: {
    columns: string[];
    rows: any[][];
  };
  nextSuggestion?: {
    type: string;
    suggestedExerciseId?: string;
    suggestions?: string[];
  };
}

@Injectable()
export class PracticeService {
  constructor(
    private prisma: PrismaService,
    private validatorService: ValidatorService,
    private aiService: AIService,
  ) {}

  async evaluateSubmission(
    userId: number,
    evaluateDto: EvaluateDto,
  ): Promise<EvaluationResult> {
    const { exerciseId, sql, mode } = evaluateDto;

    console.log('Evaluating submission for userId:', userId); // Debug logging

    if (!userId || typeof userId !== 'number') {
      throw new BadRequestException('Valid user ID is required');
    }

    // First, verify the exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { lesson: true },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with id "${exerciseId}" not found`);
    }

    // Basic SQL validation
    if (!sql.trim()) {
      throw new BadRequestException('SQL query cannot be empty');
    }

    // Execute SQL using validator
    const validationResult = await this.validatorService.run(sql.trim(), {
      timeout: 5000,
      maxRows: 100,
    });

    // Determine if correct (for now, just check if no error occurred)
    const isCorrect = validationResult.error === null;
    
    // Prepare context for AI
    const aiContext = {
      userSQL: sql.trim(),
      expectedSQL: exercise.expectedSql || undefined,
      userResult: validationResult.result,
      expectedResult: exercise.expectedResult as any,
      exercisePrompt: exercise.prompt,
      difficulty: exercise.difficulty,
      isCorrect,
      validationError: validationResult.error || undefined,
    };

    // Get AI feedback (with fallback)
    let aiFeedback: string;
    let aiSuggestions: string[] = [];
    
    try {
      console.log('🤖 Calling AI service for feedback...');
      const aiResponse = await this.aiService.generateFeedback(aiContext);
      console.log('🤖 AI Response received:', aiResponse);
      aiFeedback = aiResponse.feedback;
      aiSuggestions = aiResponse.suggestions || [];
    } catch (error) {
      console.log('❌ AI service error, using fallback:', error.message);
      // Use validator feedback as fallback
      aiFeedback = this.generateValidatorFeedback(sql, mode, validationResult.result, validationResult.error);
    }

    // Calculate score based on correctness
    const score = this.calculateScore(isCorrect, exercise.difficulty);

    // Store the attempt in database
    const attempt = await this.prisma.attempt.create({
      data: {
        userId,
        exerciseId,
        sql: sql.trim(),
        isCorrect,
        feedback: aiFeedback,
        result: validationResult.result,
        score,
      },
    });

    // Return comprehensive evaluation result
    return {
      isCorrect,
      feedback: attempt.feedback!,
      resultPreview: attempt.result as any,
      nextSuggestion: {
        type: isCorrect ? 'difficulty_up' : 'hint',
        suggestedExerciseId: isCorrect ? await this.findNextExercise(exercise) : undefined,
        suggestions: aiSuggestions,
      },
    };
  }

  private generateValidatorFeedback(
    sql: string, 
    mode: EvaluationMode, 
    result?: { columns: string[]; rows: any[][] },
    error?: string | null
  ): string {
    if (error) {
      return `SQL Error: ${error}`;
    }

    if (!result) {
      return 'Query processed but no result data available.';
    }

    if (mode === EvaluationMode.EXPLAIN) {
      return `Query executed successfully! Your SQL "${sql.substring(0, 50)}..." returned ${result.rows.length} rows with columns: ${result.columns.join(', ')}. AI explanation will be available in the next sprint.`;
    }

    // Generate feedback based on execution result
    const rowCount = result.rows.length;
    const columnCount = result.columns.length;
    
    if (rowCount === 0) {
      return `Your query executed successfully but returned no results. Check if your WHERE conditions are too restrictive or if the data exists.`;
    }
    
    return `Great! Your query executed successfully and returned ${rowCount} row(s) with ${columnCount} column(s): ${result.columns.join(', ')}. The validator has confirmed your SQL syntax is correct.`;
  }

  private calculateScore(isCorrect: boolean, difficulty: string): number {
    if (!isCorrect) return 0;
    
    const difficultyMultiplier = {
      'intro': 5,
      'beginner': 10,
      'intermediate': 15,
      'advanced': 20,
    };
    
    return difficultyMultiplier[difficulty as keyof typeof difficultyMultiplier] || 10;
  }

  private async findNextExercise(currentExercise: any): Promise<string | undefined> {
    try {
      const nextExercise = await this.prisma.exercise.findFirst({
        where: {
          lessonId: currentExercise.lessonId,
          orderIndex: {
            gt: currentExercise.orderIndex,
          },
        },
        orderBy: {
          orderIndex: 'asc',
        },
        select: {
          id: true,
        },
      });

      return nextExercise?.id;
    } catch (error) {
      return undefined;
    }
  }

  async getUserAttempts(userId: number, exerciseId?: string) {
    return await this.prisma.attempt.findMany({
      where: {
        userId,
        ...(exerciseId && { exerciseId }),
      },
      include: {
        exercise: {
          include: {
            lesson: {
              select: {
                title: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
