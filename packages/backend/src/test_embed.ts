import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: "Hello",
    });
    console.log("gemini-embedding-001 dims:", res.embeddings?.[0]?.values?.length);
    
    // Try truncating or outputDimensionality?
    const res2 = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: "Hello",
        config: { outputDimensionality: 768 }
    });
    console.log("with outputDimensionality 768:", res2.embeddings?.[0]?.values?.length);
  } catch(e) {
    console.log("error:", e.message);
  }
}
run();
