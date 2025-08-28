import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  async findAll(includeDrafts = false) {
    return await this.prisma.lesson.findMany({
      where: includeDrafts ? {} : { isActive: true },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        orderIndex: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { slug },
      include: {
        exercises: {
          select: {
            id: true,
            prompt: true,
            difficulty: true,
            orderIndex: true,
            hints: true,
            createdAt: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with slug "${slug}" not found`);
    }

    return lesson;
  }

  async findById(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        exercises: {
          select: {
            id: true,
            prompt: true,
            difficulty: true,
            orderIndex: true,
            hints: true,
            createdAt: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id "${id}" not found`);
    }

    return lesson;
  }
}
