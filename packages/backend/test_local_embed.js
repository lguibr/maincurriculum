import { env, pipeline } from "@xenova/transformers";

async function test() {
    try {
        const embedder = await pipeline("feature-extraction", "Xenova/nomic-embed-text-v1.5", { quantized: true });
        // By default, nomic recommends `pooling: 'mean', normalize: true` for embeddings
        const result = await embedder("Hello world", { pooling: "mean", normalize: true });
        console.log("Vector dimensions:", result.dims); // Should be [1, 768]
        console.log("Data length:", result.data.length); 
        console.log("First values:", Array.from(result.data).slice(0, 5));
    } catch(e) {
        console.error(e);
    }
}
test();
