import { dbOps } from "../db/indexedDB";
import { GeminiInference } from "./GeminiInference";
import { ProjectChunkEmbedding } from "../db/indexedDB";

/**
 * Computes the cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 means identical.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SemanticSearchResult {
  chunk: ProjectChunkEmbedding;
  score: number;
}

/**
 * Converts query into an embedding, then scores all stored codebase chunks.
 * Returns chunks scoring higher than `threshold`, sorted by highest score first.
 */
export async function performSemanticSearch(queryText: string, threshold = 0.60, limit = 20): Promise<SemanticSearchResult[]> {
  try {
    const queryEmbedding = await GeminiInference.getEmbedding(queryText);
    const allEmbeddings = await dbOps.getEmbeddings();
    
    const results: SemanticSearchResult[] = [];
    
    for (const chunk of allEmbeddings) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue;
      
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= threshold) {
        results.push({ chunk, score });
      }
    }
    
    // Sort descending by score
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
  } catch (error) {
    console.error("Semantic search failed:", error);
    return [];
  }
}
