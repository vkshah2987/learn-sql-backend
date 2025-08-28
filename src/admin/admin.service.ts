import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async seedLessons() {
    const lessons = [
      {
        slug: 'intro-to-select',
        title: 'Introduction to SELECT',
        summary: 'Learn the basics of selecting data from database tables',
        content: {
          sections: [
            {
              type: 'text',
              content: 'The SELECT statement is used to query data from a database table.',
            },
            {
              type: 'code',
              content: 'SELECT column1, column2 FROM table_name;',
            },
            {
              type: 'text',
              content: 'You can select all columns using the asterisk (*) wildcard.',
            },
            {
              type: 'code',
              content: 'SELECT * FROM table_name;',
            },
          ],
        },
        orderIndex: 1,
        tags: ['select', 'basics', 'intro'],
        exercises: [
          {
            prompt: 'Select all columns from the users table.',
            expectedSql: 'SELECT * FROM users;',
            difficulty: 'intro',
            orderIndex: 1,
            hints: ['Use the asterisk (*) to select all columns', 'Remember the semicolon at the end'],
          },
          {
            prompt: 'Select only the name and email columns from the users table.',
            expectedSql: 'SELECT name, email FROM users;',
            difficulty: 'intro',
            orderIndex: 2,
            hints: ['Separate column names with commas', 'Column names are case-sensitive'],
          },
        ],
      },
      {
        slug: 'filtering-with-where',
        title: 'Filtering Data with WHERE',
        summary: 'Learn to filter database results using the WHERE clause',
        content: {
          sections: [
            {
              type: 'text',
              content: 'The WHERE clause is used to filter records based on specified conditions.',
            },
            {
              type: 'code',
              content: 'SELECT * FROM table_name WHERE condition;',
            },
            {
              type: 'text',
              content: 'Common operators include =, !=, <, >, <=, >=, LIKE, and IN.',
            },
          ],
        },
        orderIndex: 2,
        tags: ['where', 'filtering', 'conditions'],
        exercises: [
          {
            prompt: 'Select all users where the age is greater than 18.',
            expectedSql: 'SELECT * FROM users WHERE age > 18;',
            difficulty: 'beginner',
            orderIndex: 1,
            hints: ['Use the > operator for greater than comparisons', 'The WHERE clause comes after FROM'],
          },
          {
            prompt: 'Select users where the email contains "@gmail.com".',
            expectedSql: 'SELECT * FROM users WHERE email LIKE "%@gmail.com";',
            difficulty: 'beginner',
            orderIndex: 2,
            hints: ['Use the LIKE operator for pattern matching', 'Use % as a wildcard for any characters'],
          },
        ],
      },
    ];

    let seededLessons = 0;
    let seededExercises = 0;

    for (const lessonData of lessons) {
      const { exercises, ...lessonInfo } = lessonData;
      
      // Create lesson (upsert to be idempotent)
      const lesson = await this.prisma.lesson.upsert({
        where: { slug: lessonInfo.slug },
        create: lessonInfo,
        update: lessonInfo,
      });
      
      seededLessons++;

      // Create exercises for this lesson
      for (const exerciseData of exercises) {
        await this.prisma.exercise.upsert({
          where: {
            lessonId_orderIndex: {
              lessonId: lesson.id,
              orderIndex: exerciseData.orderIndex,
            },
          },
          create: {
            ...exerciseData,
            lessonId: lesson.id,
          },
          update: {
            ...exerciseData,
            lessonId: lesson.id,
          },
        });
        seededExercises++;
      }
    }

    return {
      status: 'ok',
      seededLessons,
      seededExercises,
    };
  }

  async resetDatabase() {
    // Delete in proper order to respect foreign key constraints
    await this.prisma.learningEvent.deleteMany();
    await this.prisma.attempt.deleteMany();
    await this.prisma.progress.deleteMany();
    await this.prisma.exercise.deleteMany();
    await this.prisma.lesson.deleteMany();
    
    return { status: 'ok', message: 'Database reset complete' };
  }
}
