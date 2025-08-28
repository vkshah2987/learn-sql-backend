export interface AIResponse {
  feedback: string;
  suggestions?: string[];
  explanation?: string;
  nextSteps?: string[];
}

export interface SQLContext {
  userSQL: string;
  expectedSQL?: string;
  userResult?: {
    columns: string[];
    rows: any[][];
  };
  expectedResult?: {
    columns: string[];
    rows: any[][];
  };
  exercisePrompt: string;
  difficulty: string;
  isCorrect: boolean;
  validationError?: string;
}

export interface AIProviderConfig {
  baseUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
}
