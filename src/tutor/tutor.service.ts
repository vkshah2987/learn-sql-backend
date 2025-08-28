import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@Injectable()
export class TutorService {
  private readonly HARMFUL_PATTERNS = [
    /drop\s+table/i,
    /delete\s+from/i,
    /truncate/i,
    /alter\s+table/i,
    /create\s+user/i,
    /grant\s+/i,
    /revoke\s+/i,
  ];

  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
  ) {}

  async chat(userId: number, dto: ChatMessageDto) {
    // Sanitize and validate the message
    this.validateMessage(dto.message);

    // Build context for the AI
    const context = await this.buildChatContext(userId, dto.context);
    
    // Generate AI response
    const aiResponse = await this.generateTutorResponse(dto.message, context);

    // Log the learning event
    await this.logChatEvent(userId, dto, aiResponse);

    return aiResponse;
  }

  private validateMessage(message: string): void {
    // Check for harmful patterns
    for (const pattern of this.HARMFUL_PATTERNS) {
      if (pattern.test(message)) {
        throw new BadRequestException(
          'Your message contains potentially harmful SQL operations. Please rephrase your question about learning SQL concepts.'
        );
      }
    }

    // Basic content filtering
    const lowercaseMessage = message.toLowerCase();
    const suspiciousTerms = ['hack', 'exploit', 'inject', 'bypass'];
    
    if (suspiciousTerms.some(term => lowercaseMessage.includes(term))) {
      throw new BadRequestException(
        'Please keep your questions focused on learning SQL concepts and techniques.'
      );
    }
  }

  private async buildChatContext(userId: number, contextData?: any) {
    const context: any = {
      role: 'SQL Tutor',
      focus: 'educational_support',
    };

    // Add lesson context if provided
    if (contextData?.lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: contextData.lessonId },
        include: {
          exercises: {
            select: {
              id: true,
              prompt: true,
              difficulty: true,
            },
          },
        },
      });

      if (lesson) {
        context.currentLesson = {
          title: lesson.title,
          summary: lesson.summary,
          exercises: lesson.exercises,
        };
      }
    }

    // Add recent learning history
    const recentAttempts = await this.prisma.attempt.findMany({
      where: { userId },
      include: {
        exercise: {
          select: {
            prompt: true,
            difficulty: true,
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
      take: 5,
    });

    context.recentActivity = recentAttempts.map(attempt => ({
      sql: attempt.sql,
      isCorrect: attempt.isCorrect,
      exercisePrompt: attempt.exercise.prompt,
      difficulty: attempt.exercise.difficulty,
      lessonTitle: attempt.exercise.lesson?.title,
    }));

    // Add user progress overview
    const progressCount = await this.prisma.progress.count({
      where: { 
        userId,
        status: 'completed',
      },
    });

    context.userLevel = progressCount === 0 ? 'beginner' : 
                       progressCount < 3 ? 'intermediate' : 'advanced';

    return context;
  }

  private async generateTutorResponse(message: string, context: any) {
    // Create focused prompt for tutoring
    const tutorPrompt = this.buildTutorPrompt(message, context);

    try {
      // Create SQLContext for AI service
      const sqlContext = {
        userSQL: '',
        exercisePrompt: tutorPrompt,
        difficulty: context.userLevel,
        isCorrect: true, // This is a chat, not an evaluation
      };

      // Get AI response
      const aiResponse = await this.aiService.generateFeedback(sqlContext);

      // Parse and structure the response
      const response = this.parseTutorResponse(aiResponse.feedback);
      
      return {
        reply: response.reply,
        references: response.references,
        followups: response.followups,
        suggestedExercises: response.suggestedExercises,
      };

    } catch (error) {
      // Fallback response for AI errors
      return this.generateFallbackResponse(message, context);
    }
  }

  private buildTutorPrompt(message: string, context: any): string {
    return `You are an expert SQL tutor. Respond helpfully and educationally to the student's question.

Student Level: ${context.userLevel}
Current Lesson: ${context.currentLesson?.title || 'None'}

${context.recentActivity?.length > 0 ? `Recent Activity:
${context.recentActivity.slice(0, 3).map((activity: any, idx: number) => 
  `${idx + 1}. ${activity.exercisePrompt} - ${activity.isCorrect ? 'Correct' : 'Incorrect'}`
).join('\n')}` : ''}

Student Question: "${message}"

Provide a helpful, educational response that:
1. Directly answers their question
2. Includes relevant SQL examples when appropriate
3. Suggests 1-2 follow-up topics or exercises
4. Keeps the tone encouraging and supportive
5. Limits response to 2-3 paragraphs

If they're asking about SQL concepts, provide clear examples.
If they're stuck on an exercise, guide them toward the solution without giving it away completely.`;
  }

  private parseTutorResponse(aiResponse: string) {
    const lines = aiResponse.split('\n').filter(line => line.trim());
    
    // Simple parsing - look for follow-up suggestions
    const followups: string[] = [];
    const references: string[] = [];
    let reply = aiResponse;

    // Extract follow-up suggestions if AI formatted them
    const followupMatch = aiResponse.match(/(?:follow.?up|try|next|suggestion)s?:?\s*(.+)/i);
    if (followupMatch) {
      followups.push(followupMatch[1].trim());
    }

    // Look for lesson/topic references
    const lessonMatch = aiResponse.match(/(?:lesson|topic|chapter):\s*([^.\n]+)/i);
    if (lessonMatch) {
      references.push(lessonMatch[1].trim());
    }

    return {
      reply: reply.trim(),
      references,
      followups,
      suggestedExercises: [], // Could be enhanced to suggest specific exercises
    };
  }

  private generateFallbackResponse(message: string, context: any) {
    const responses = [
      {
        reply: "I'm here to help you learn SQL! Could you please rephrase your question? I can help with SELECT statements, WHERE clauses, JOINs, and other SQL concepts.",
        references: [],
        followups: [
          "Try asking about specific SQL commands like SELECT or WHERE",
          "Ask me to explain any SQL concept you're curious about",
        ],
      },
      {
        reply: "Great question! SQL can be tricky at first, but with practice it becomes much clearer. What specific part of SQL would you like me to explain?",
        references: [],
        followups: [
          "Ask about basic SELECT queries",
          "Learn about filtering data with WHERE clauses",
        ],
      },
    ];

    // Select response based on user level
    const responseIndex = context.userLevel === 'beginner' ? 0 : 1;
    return responses[responseIndex];
  }

  private async logChatEvent(userId: number, dto: ChatMessageDto, response: any) {
    try {
      await this.prisma.learningEvent.create({
        data: {
          userId,
          eventType: 'tutor_chat',
          metadata: {
            question: dto.message,
            context: dto.context || null,
            responseLength: response.reply?.length || 0,
            hadAIResponse: !!response.reply,
          } as any,
        },
      });
    } catch (error) {
      // Don't fail the request if logging fails
      console.error('Failed to log chat event:', error);
    }
  }
}
