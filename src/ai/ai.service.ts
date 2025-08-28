import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIResponse, SQLContext, AIProviderConfig } from './interfaces';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly config: AIProviderConfig;
  private responseCache = new Map<string, { response: AIResponse; timestamp: number }>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour

  constructor(private configService: ConfigService) {
    this.config = {
      baseUrl: this.configService.get('OLLAMA_BASE_URL', 'http://localhost:11434'),
      model: this.configService.get('OLLAMA_MODEL', 'codellama:7b'),
      timeout: this.getOptimalTimeout(),
      maxRetries: parseInt(this.configService.get('AI_MAX_RETRIES', '2')),
    };
    
    this.logger.log(`AI Service initialized with timeout: ${this.config.timeout}ms for ${process.platform}/${process.arch}`);
  }

  // Dynamic timeout based on system capabilities
  private getOptimalTimeout(): number {
    const configTimeoutStr = this.configService.get('AI_TIMEOUT_SECONDS');
    const configTimeout = configTimeoutStr ? parseInt(configTimeoutStr) : 0;
    if (configTimeout > 0) return configTimeout * 1000;
    
    // Auto-detect system and set appropriate timeout
    const platform = process.platform;
    const arch = process.arch;
    
    // M1/M2 Macs need more time for AI processing
    if (platform === 'darwin' && arch === 'arm64') {
      return 180000; // 3 minutes for Apple Silicon
    }
    
    // Intel Macs and other systems
    if (platform === 'darwin') {
      return 120000; // 2 minutes for Intel Mac
    }
    
    // Linux/Windows systems
    return 90000; // 1.5 minutes for other systems
  }

  async generateFeedback(context: SQLContext): Promise<AIResponse> {
    try {
      console.log('🚀 AI Service: Starting feedback generation');
      // Create cache key based on context
      const cacheKey = this.createCacheKey(context);
      
      // Check cache first
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        console.log('📦 AI Service: Returning cached response');
        this.logger.log('Returning cached AI response');
        return cached;
      }

      console.log('🔄 AI Service: Cache miss, calling AI');
      // Generate AI response
      const response = await this.callAI(context);
      console.log('✅ AI Service: AI call successful');
      
      // Cache the response
      this.cacheResponse(cacheKey, response);
      
      return response;
    } catch (error) {
      console.log('💥 AI Service: Error occurred:', error.message);
      this.logger.error(`AI service error: ${error.message}`);
      return this.getFallbackResponse(context);
    }
  }

  private async callAI(context: SQLContext): Promise<AIResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    // Combine system and user prompts for generate API
    const combinedPrompt = `${systemPrompt}

${userPrompt}`;

    const payload = {
      model: this.config.model,
      prompt: combinedPrompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 500,
      }
    };

    // Retry logic for better reliability
    let lastError: Error = new Error('AI request failed');
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      console.log(`📡 AI Service: Attempt ${attempt}/${this.config.maxRetries}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ AI Service: Timeout after ${this.config.timeout}ms`);
        controller.abort();
      }, this.config.timeout);

      try {
        console.log('📡 AI Service: Making request to Ollama...');
        this.logger.log(`Calling Ollama API (attempt ${attempt}/${this.config.maxRetries})...`);
        
        const response = await fetch(`${this.config.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('📡 AI Service: Got response, status:', response.status);

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📝 AI Service: Parsed response data:', data);
        const aiMessage = data.response || 'No response from AI';

        return this.parseAIResponse(aiMessage, context);
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
        console.log(`💥 AI Service: Attempt ${attempt} failed:`, error.message);
        
        if (error.name === 'AbortError') {
          console.log('💥 AI Service: Request timed out');
          lastError = new Error(`AI request timeout after ${this.config.timeout}ms`);
        }

        // If this was the last attempt, don't wait
        if (attempt < this.config.maxRetries) {
          console.log(`🔄 AI Service: Waiting 2s before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
        }
      }
    }

    console.log('💥 AI Service: Error occurred:', lastError.message);
    throw lastError;
  }

  private buildSystemPrompt(): string {
    return `You are a SQL tutor. Provide brief, helpful feedback on student SQL queries.

Guidelines:
- Be encouraging and specific
- Explain what works and what needs improvement
- Give 1-2 actionable suggestions
- Keep responses under 100 words

Format: Plain text feedback only.`;
  }

  private buildUserPrompt(context: SQLContext): string {
    let prompt = `Exercise: ${context.exercisePrompt}\n\nStudent SQL:\n${context.userSQL}\n\n`;
    
    if (context.validationError) {
      prompt += `Error: ${context.validationError}\n`;
    } else if (context.userResult) {
      prompt += `Result: ${context.userResult.rows.length} rows returned\n`;
    }

    prompt += `Status: ${context.isCorrect ? 'SUCCESS' : 'NEEDS WORK'}\n\nProvide brief feedback:`;
    return prompt;
  }

  private parseAIResponse(aiMessage: string, context: SQLContext): AIResponse {
    // For now, return the AI message as feedback
    // In the future, we could parse structured responses
    return {
      feedback: aiMessage.trim(),
      suggestions: [], // Could be parsed from structured AI response
      explanation: '', // Could be extracted from AI response
      nextSteps: [], // Could be suggested by AI
    };
  }

  private getFallbackResponse(context: SQLContext): AIResponse {
    if (context.validationError) {
      return {
        feedback: `I encountered an issue with your SQL query: ${context.validationError}. Please check your syntax and try again. Remember, only SELECT statements are allowed in this exercise.`,
        suggestions: ['Check your SQL syntax', 'Ensure you\'re using SELECT statements only'],
      };
    }

    if (context.isCorrect && context.userResult) {
      const rowCount = context.userResult.rows.length;
      return {
        feedback: `Great job! Your query executed successfully and returned ${rowCount} row(s). Your SQL syntax is correct and you're getting real data from the database. Keep practicing with more complex queries!`,
        suggestions: ['Try adding WHERE clauses', 'Experiment with different column selections'],
      };
    }

    return {
      feedback: 'Your query has been processed. The AI tutor is temporarily unavailable, but you can continue practicing. Check if your query returns the expected results.',
      suggestions: ['Review the exercise requirements', 'Test your query step by step'],
    };
  }

  private createCacheKey(context: SQLContext): string {
    const keyData = {
      sql: context.userSQL.trim().toLowerCase(),
      prompt: context.exercisePrompt,
      error: context.validationError || null,
      isCorrect: context.isCorrect,
      resultColumns: context.userResult?.columns || [],
      resultRowCount: context.userResult?.rows.length || 0,
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private getCachedResponse(key: string): AIResponse | null {
    const cached = this.responseCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.response;
    }
    
    if (cached) {
      this.responseCache.delete(key);
    }
    
    return null;
  }

  private cacheResponse(key: string, response: AIResponse): void {
    this.responseCache.set(key, {
      response,
      timestamp: Date.now(),
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      return response.ok;
    } catch (error) {
      this.logger.warn(`AI service health check failed: ${error.message}`);
      return false;
    }
  }
}
