import { FilesetResolver, LlmInference } from "@mediapipe/tasks-genai";

let llmInferenceInstance: LlmInference | null = null;
let isInitializing = false;

/**
 * Singleton wrapper around MediaPipe's LlmInference to run Gemma 4 E2B locally.
 */
export type GemmaModelSize = "e4b" | "26b-moe";

export class Gemma4Inference {
  static async initialize(
    modelSize: GemmaModelSize = "e4b",
    onProgress?: (progress: number) => void
  ): Promise<LlmInference> {
    if (llmInferenceInstance) return llmInferenceInstance;
    if (isInitializing) {
      while (isInitializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return llmInferenceInstance!;
    }

    isInitializing = true;
    try {
      const genaiFileset = await FilesetResolver.forGenAiTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm"
      );

      // Select the optimal WebGPU weights for Gemma 4 based on requested size
      const modelPath =
        modelSize === "26b-moe"
          ? "https://storage.googleapis.com/mediapipe-models/genai/gemma-4-26b-moe/float16/1/gemma-4-26b-moe-it-gpu-int4.bin"
          : "https://storage.googleapis.com/mediapipe-models/genai/gemma-4-4b/float16/1/gemma-4-4b-it-gpu-int4.bin";

      console.log(
        `Loading Gemma 4 (${modelSize === "26b-moe" ? "26B MoE" : "Effective 4B"}) via WebGPU...`
      );

      llmInferenceInstance = await LlmInference.createFromOptions(genaiFileset, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: "GPU",
        },
        maxTokens: 1024,
        topK: 40,
        temperature: 0.1,
      });
      console.log("Gemma 4 LLM Instance Loaded via WebGPU");
      return llmInferenceInstance;
    } catch (e) {
      console.error("Failed to load Gemma 4 MediaPipe Instance:", e);
      throw e;
    } finally {
      isInitializing = false;
    }
  }

  static async generate(
    prompt: string,
    format: "json" | "text" = "text",
    modelSize: GemmaModelSize = "e4b"
  ): Promise<string> {
    const llm = await this.initialize(modelSize);
    // Forcing strict JSON output behavior in prompt if asked.
    const strictPrompt =
      format === "json"
        ? `You are an extraction system. OUTPUT ONLY VALID JSON. Do NOT output markdown formatting like \`\`\`json. DO NOT output conversational text.\nPROMPT:\n${prompt}`
        : prompt;

    return await llm.generateResponse(strictPrompt);
  }
}
