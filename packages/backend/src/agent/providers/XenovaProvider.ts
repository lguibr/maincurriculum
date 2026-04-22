import { IEmbeddingProvider } from "./interfaces";
import { EmbedderPipeline } from "../subgraphs/ingestion"; // Temporarily use existing pipeline

export class XenovaProvider implements IEmbeddingProvider {
  async embedText(text: string): Promise<number[]> {
    const embedder = await EmbedderPipeline.getInstance();
    const res = await embedder([text], { pooling: "mean", normalize: true });
    return res.tolist()[0];
  }
}
