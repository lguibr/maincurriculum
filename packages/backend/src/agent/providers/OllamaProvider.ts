import { ILLMProvider } from "./interfaces";
import { ChatOllama } from "@langchain/ollama";
import { ZodSchema } from "zod";

export class OllamaProvider implements ILLMProvider {
  private llm: ChatOllama;

  constructor(model: string = "gemma4", temp: number = 0) {
    this.llm = new ChatOllama({ model, temperature: temp, maxRetries: 0 });
  }

  async invoke(prompt: string, systemPrompt: string = ""): Promise<string> {
    const msgs = systemPrompt ? [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] : [{ role: "user", content: prompt }];
    const res = await this.llm.invoke(msgs);
    return res.content.toString();
  }

  async extractStructuredJSON<T>(schema: ZodSchema, prompt: string, systemPrompt: string = ""): Promise<T> {
    const structuredLlm = this.llm.withStructuredOutput(schema);
    let attempts = 0;
    const maxRetries = 2;
    let latestError = "";

    while (attempts <= maxRetries) {
      try {
        const msgs = [{ role: "system", content: systemPrompt + (latestError ? `\n\nFix this error from previous output: ${latestError}` : "") }, { role: "user", content: prompt }];
        const res = await structuredLlm.invoke(msgs);
        return res as T;
      } catch (err: any) {
        attempts++;
        latestError = err.message || "Failed to parse JSON.";
        if (attempts > maxRetries) throw new Error(`LLM Structured Output Failed: ${latestError}`);
      }
    }
    throw new Error("Failed to extract JSON");
  }
}
