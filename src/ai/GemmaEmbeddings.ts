import { pipeline, FeatureExtractionPipeline, env } from "@huggingface/transformers";

// Optional: Enable WebGPU for transformers.js explicitly
// We assume transformers.js v3+ is used
env.allowLocalModels = false; // We fetch directly from HuggingFace Hub

export class GemmaEmbeddings {
  private static extractorInstance: FeatureExtractionPipeline | null = null;
  private static isInitializing = false;

  static async initialize(
    onProgress?: (progress: any) => void
  ): Promise<FeatureExtractionPipeline> {
    if (this.extractorInstance) return this.extractorInstance;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return this.extractorInstance!;
    }

    this.isInitializing = true;
    try {
      console.log("Loading EmbeddingGemma 300M ONNX via WebGPU...");
      // For v3 of @huggingface/transformers, `device: 'webgpu'` can be passed.
      this.extractorInstance = await pipeline(
        "feature-extraction",
        "onnx-community/embeddinggemma-300m-ONNX",
        {
          device: "webgpu", // Hardware acceleration
          dtype: "fp16", // Quantize floating point to reduce VRAM
          progress_callback: onProgress,
        }
      );
      console.log("EmbeddingGemma instance started successfully.");
      return this.extractorInstance;
    } catch (e) {
      console.error("Failed to load EmbeddingGemma:", e);
      // Fallback to wasm if webgpu fails or not supported
      console.log("Falling back to standard WASM CPU execution...");
      this.extractorInstance = await pipeline(
        "feature-extraction",
        "onnx-community/embeddinggemma-300m-ONNX",
        {
          progress_callback: onProgress,
        }
      );
      return this.extractorInstance;
    } finally {
      this.isInitializing = false;
    }
  }

  static async getEmbedding(text: string): Promise<number[]> {
    const extractor = await this.initialize();

    // pooling: 'mean' generates a single dense vector representing the whole sentence context.
    // normalize: true outputs a normalized vector (L2 norm) which ensures simple cosine similarity defaults to dot-product.
    const output = await extractor(text, { pooling: "mean", normalize: true });

    // The output is a Tensor. We serialize to regular JS Float array.
    return Array.from(output.data);
  }
}
