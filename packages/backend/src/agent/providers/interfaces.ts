import { ZodSchema } from "zod";

export interface ILLMProvider {
  invoke(prompt: string, systemPrompt?: string): Promise<string>;
  extractStructuredJSON<T>(schema: ZodSchema, prompt: string, systemPrompt?: string): Promise<T>;
}

export interface IEmbeddingProvider {
  embedText(text: string): Promise<number[]>;
}

// Simplified generic persistence provider for the agent context
export interface IPersistenceProvider {
  executeQuery(query: string, values: any[]): Promise<any>;
}
