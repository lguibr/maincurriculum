export class GeminiInference {
  /**
   * Fast, structured generation using Gemini API (Cloud Mode)
   */
  static async generate(
    prompt: string,
    format: "json" | "text" = "text",
    modelName = "gemini-3.0-flash"
  ): Promise<string> {
    const apiKey = localStorage.getItem("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("Missing Gemini API Key in localStorage. Please set it in the UI.");
    }

    const strictPrompt =
      format === "json"
        ? `You are an extraction system. OUTPUT ONLY VALID JSON. Do NOT output markdown formatting like \`\`\`json. DO NOT output conversational text.\nPROMPT:\n${prompt}`
        : prompt;

    console.log(`[Cloud] Sending prompt to ${modelName}...`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: strictPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 40,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error: ${err}`);
    }

    const data = await response.json();
    let textOut = "";
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        textOut = candidate.content.parts[0].text || "";
      } else {
        console.warn("Gemini output blocked or empty:", candidate);
        textOut = "CV generation returned empty. (Possible Safety Filter Block)";
      }
    }

    // Clean up markdown block if it maliciously sneaks it in via gemini
    if (format === "json") {
      textOut = textOut
        .replace(/^```json/g, "")
        .replace(/```$/g, "")
        .trim();
    }

    return textOut;
  }

  /**
   * Fast text embedding using Gemini's text-embedding-004 model
   */
  static async getEmbedding(text: string): Promise<number[]> {
    const apiKey = localStorage.getItem("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("Missing Gemini API Key in localStorage. Please set it in the UI.");
    }

    console.log(`[Cloud] Fetching embeddings from gemini-embedding-2...`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "models/gemini-embedding-2",
          content: {
            parts: [{ text: text }],
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Embedding Error: ${err}`);
    }

    const data = await response.json();
    if (data.embedding && data.embedding.values) {
      return data.embedding.values;
    }

    throw new Error("Invalid embedding response from Gemini API");
  }
}
