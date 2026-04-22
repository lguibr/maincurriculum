import { IEmbeddingProvider } from "./interfaces";
import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = true;

class EmbedderPipeline {
  static task = "feature-extraction";
  static model = "Xenova/all-MiniLM-L6-v2";
  static instancePromise: Promise<any> | null = null;

  static async getInstance() {
    if (!this.instancePromise) {
      this.instancePromise = pipeline(this.task as any, this.model, { quantized: true });
    }
    return this.instancePromise;
  }
}

export class XenovaProvider implements IEmbeddingProvider {
  async embedText(text: string): Promise<number[]> {
    const embedder = await EmbedderPipeline.getInstance();
    const res = await embedder([text], { pooling: "mean", normalize: true });
    return res.tolist()[0];
  }
}
