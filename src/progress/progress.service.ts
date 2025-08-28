import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteLessonDto } from './dto/complete-lesson.dto';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  async completeLesson(userId: number, dto: CompleteLessonDto) {
    // Verify lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id "${dto.lessonId}" not found`);
    }

    // Check if progress already exists
    const existingProgress = await this.prisma.progress.findUnique({
      where: {
        userId_lessonId: {
          userId: userId,
          lessonId: dto.lessonId,
        },
      },
    });

    if (existingProgress && existingProgress.status === 'completed') {
      throw new ConflictException('Lesson already completed');
    }

    // Calculate score from attempts for this lesson
    const lessonExercises = await this.prisma.exercise.findMany({
      where: { lessonId: dto.lessonId },
      select: { id: true },
    });

    const exerciseIds = lessonExercises.map(ex => ex.id);
    
    const attempts = await this.prisma.attempt.findMany({
      where: {
        userId: userId,
        exerciseId: { in: exerciseIds },
      },
      select: { score: true, isCorrect: true },
    });

    // Calculate total score: base score from attempts + any bonus scoreDelta
    const baseScore = attempts.reduce((total, attempt) => total + attempt.score, 0);
    const totalScore = baseScore + (dto.scoreDelta || 0);

    // Update or create progress record
    const progress = await this.prisma.progress.upsert({
      where: {
        userId_lessonId: {
          userId: userId,
          lessonId: dto.lessonId,
        },
      },
      update: {
        status: 'completed',
        score: totalScore,
        completedAt: new Date(),
      },
      create: {
        userId: userId,
        lessonId: dto.lessonId,
        status: 'completed',
        score: totalScore,
        completedAt: new Date(),
      },
    });

    // Log completion event
    await this.prisma.learningEvent.create({
      data: {
        userId: userId,
        eventType: 'lesson_completed',
        metadata: {
          lessonId: dto.lessonId,
          score: totalScore,
          attemptsCount: attempts.length,
          correctAttempts: attempts.filter(a => a.isCorrect).length,
        },
      },
    });

    return {
      lessonId: dto.lessonId,
      status: 'completed' as const,
      score: totalScore,
      completedAt: progress.completedAt,
    };
  }

  async getUserProgress(userId: number) {
    const progress = await this.prisma.progress.findMany({
      where: { userId },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            slug: true,
            orderIndex: true,
          },
        },
      },
      orderBy: {
        lesson: {
          orderIndex: 'asc',
        },
      },
    });

    return progress.map(p => ({
      lessonId: p.lessonId,
      lesson: p.lesson,
      status: p.status,
      score: p.score,
      completedAt: p.completedAt,
      createdAt: p.createdAt,
    }));
  }

  async getLessonProgress(userId: number, lessonId: string) {
    const progress = await this.prisma.progress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    if (!progress) {
      return null;
    }

    return {
      lessonId: progress.lessonId,
      lesson: progress.lesson,
      status: progress.status,
      score: progress.score,
      completedAt: progress.completedAt,
      createdAt: progress.createdAt,
    };
  }
}
