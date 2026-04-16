import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { appGraph } from "./agent/graph";
import { Command } from "@langchain/langgraph";
import { pool } from "./db/client";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const app = express();
const port = process.env.BACKEND_PORT || 3001;

let activeSSEClient: express.Response | null = null;
const SINGLETON_THREAD_ID = "local_dev_thread_1";

app.use(cors());
app.use(express.json());

// Main SSE Stream Endpoint
app.get("/api/ingest/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: "connected", message: "SSE connected successfully" })}\n\n`);

  activeSSEClient = res;

  // Define an interval to ping the client so the connection stays open
  const pingInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
  }, 15000);

  // When client disconnects, clean up
  req.on("close", () => {
    clearInterval(pingInterval);
    if (activeSSEClient === res) {
      activeSSEClient = null;
    }
  });
});

app.post("/api/ingest/start", async (req, res) => {
  const { githubUrl, baseCv } = req.body;

  if (!githubUrl || !baseCv) {
    return res.status(400).json({ error: "Missing githubUrl or baseCv" });
  }

  res.status(200).json({ status: "Ingestion pipeline launched" });

  const githubHandle = githubUrl.split("/").pop() || "";

  try {
    let preloadedMessages: any[] = [];
    const latestProfileReq = await pool.query("SELECT demographics_json FROM user_profiles WHERE github_handle = $1 ORDER BY id DESC LIMIT 1", [githubHandle]);

    if (latestProfileReq.rows.length > 0) {
      const dem = latestProfileReq.rows[0].demographics_json;
      for (const key of ['skills', 'education', 'experience']) {
        if (Array.isArray(dem[key])) {
          dem[key].forEach((qa: any) => {
            preloadedMessages.push({ role: 'assistant', content: `[${key}] ${qa.question}` });
            preloadedMessages.push({ role: 'user', content: qa.answer });
          });
        }
      }
    }

    for await (const event of await appGraph.streamEvents(
      { githubUrl, baseCv, githubHandle, messages: preloadedMessages },
      { version: "v2", configurable: { thread_id: SINGLETON_THREAD_ID } }
    )) {
      if (!activeSSEClient) continue;

      const evtName = event.event;
      if (evtName === "on_custom_event") {
        activeSSEClient.write(`data: ${JSON.stringify({ type: "log", message: (event.data as any).msg })}\n\n`);

        if (event.name === "interrupt") {
          activeSSEClient.write(`data: ${JSON.stringify({ type: "interrupt", data: event.data })}\n\n`);
        }
      } else if (evtName === "on_chat_model_stream") {
        activeSSEClient.write(`data: ${JSON.stringify({ type: "token", message: event.data.chunk.text })}\n\n`);
      }
    }

    // Check if graph formally ended or suspended (interrupted)
    const state = await appGraph.getState({ configurable: { thread_id: SINGLETON_THREAD_ID } });
    if (state.tasks.some((t: any) => t.interrupts.length > 0)) {
      const payload = state.tasks[0]?.interrupts[0]?.value as { phase?: string, question?: string };
      if (activeSSEClient && payload) {
        // Since it's an object, just send it directly as data
        activeSSEClient.write(`data: ${JSON.stringify({ type: "interrupt", data: payload })}\n\n`);
      }
    } else {
      if (activeSSEClient) {
        activeSSEClient.write(`data: ${JSON.stringify({ type: "complete", data: { completed: true } })}\n\n`);
      }
    }
  } catch (e: any) {
    console.error("Execution error:", e.message);
    if (activeSSEClient) {
      activeSSEClient.write(`data: ${JSON.stringify({ type: "log", message: "ERROR: " + e.message })}\n\n`);
    }
  }
});

app.post("/api/ingest/answer", async (req, res) => {
  const { answer } = req.body;
  res.status(200).json({ status: "Answer received" });

  try {
    // Resume the graph by passing an explicit Command object resolving the interrupt
    for await (const event of await appGraph.streamEvents(
      new Command({ resume: answer }),
      { version: "v2", configurable: { thread_id: SINGLETON_THREAD_ID } }
    )) {
      if (!activeSSEClient) continue;
      if (event.event === "on_custom_event") {
        activeSSEClient.write(`data: ${JSON.stringify({ type: "log", message: (event.data as any).msg })}\n\n`);
      }
    }

    const state = await appGraph.getState({ configurable: { thread_id: SINGLETON_THREAD_ID } });
    if (state.tasks.some((t: any) => t.interrupts.length > 0)) {
      const payload = state.tasks[0]?.interrupts[0]?.value as { phase?: string, question?: string };
      if (activeSSEClient && payload) {
        activeSSEClient.write(`data: ${JSON.stringify({ type: "interrupt", data: payload })}\n\n`);
      }
    } else {
      if (activeSSEClient) {
        activeSSEClient.write(`data: ${JSON.stringify({ type: "complete", data: { completed: true } })}\n\n`);
      }
    }
  } catch (e: any) {
    console.error("Resume error:", e.message);
  }
});

app.get("/api/profile/latest", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM user_profiles ORDER BY id DESC LIMIT 1");
    if (result.rows.length === 0) return res.status(404).json({ error: "No profiles found" });
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/reset", async (req, res) => {
  try {
    await pool.query(`
      TRUNCATE TABLE cv_versions, project_embeddings, projects_raw_text, user_profiles RESTART IDENTITY CASCADE;
    `);
    res.json({ success: true, message: "Database completely factory reset." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/profile/:id", async (req, res) => {
  try {
    const { demographics_json, base_cv } = req.body;
    await pool.query(
      "UPDATE user_profiles SET demographics_json = $1::jsonb, base_cv = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      [typeof demographics_json === 'string' ? demographics_json : JSON.stringify(demographics_json), base_cv, req.params.id]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/profile/:id/extended", async (req, res) => {
  try {
    const { extended_cv } = req.body;
    await pool.query(
      "UPDATE user_profiles SET extended_cv = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [extended_cv, req.params.id]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/tailor", async (req, res) => {
  try {
    const { jobDescription, profileId, employerQuestions } = req.body;
    if (!profileId) return res.status(404).json({error: "Profile missing"});
        
    const profileRes = await pool.query("SELECT * FROM user_profiles WHERE id = $1", [profileId]);
    const profile = profileRes.rows[0];
    if (!profile) return res.status(404).json({error: "Profile missing"});
        
    const embedder = await EmbedderPipeline.getInstance();
    const embedRes = await embedder(jobDescription, { pooling: 'mean', normalize: true });
    const vector = `[${Array.from(embedRes.data).join(",")}]`;
        
    const similaritySearch = await pool.query(`
        SELECT p.repo_name, e.chunk_text, 1 - (e.embedding <=> $1) as similarity
        FROM project_embeddings e
        JOIN projects_raw_text p ON p.id = e.project_id
        WHERE p.user_profile_id = $2
        ORDER BY e.embedding <=> $1 LIMIT 5
    `, [vector, profileId]);
        
    let context = similaritySearch.rows.map((r: any) => `Repo: ${r.repo_name}\n${r.chunk_text}`).join("\n\n");
    const prompt = `You are an expert technical recruiter and resume writer. 
Generate a comprehensive application packet for the candidate trying to get the following job.

Original CV Context (Mega CV if available, otherwise Base CV):
${profile.extended_cv || profile.base_cv}

Candidate Demographics (Interview Memory):
${JSON.stringify(profile.demographics_json)}

Top Relevant Extracted RAG Repos for this specific job context:
${context}

# Job Description
${jobDescription}

# Application/Employer Questions (Optional)
${employerQuestions || "No additional questions requested by employer."}

OUTPUT INSTRUCTIONS:
You MUST output ONLY a valid stringified JSON object matching this exact structure:
{
  "tailoredCv": "# Markdown content of the beautifully tailored CV mapped perfectly to the Job Description...",
  "coverLetter": "# Beautifully written markdown cover letter...",
  "employerAnswers": "# Detailed markdown responding to any specific Application/Employer Questions listed above. Leave blank if none were provided."
}
Return ONLY valid JSON without backticks or markdown wrappers.`;

    const generation = await ai.models.generateContent({
         model: "gemini-3-flash-preview",
         contents: prompt
    });
        
    const rawOutput = generation.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || "{}";
    let parsed = { tailoredCv: "", coverLetter: "", employerAnswers: "" };
    try {
       parsed = JSON.parse(rawOutput);
    } catch(err) {
       console.error("JSON parse failure on Tailor response.");
    }
        
    // Save versions to Database
    if (parsed.tailoredCv) {
        await pool.query(
            "INSERT INTO cv_versions (user_profile_id, version_type, job_description, raw_markdown) VALUES ($1, $2, $3, $4)",
            [profileId, 'tailored', jobDescription, parsed.tailoredCv]
        );
    }
    if (parsed.coverLetter) {
        await pool.query(
            "INSERT INTO cv_versions (user_profile_id, version_type, job_description, raw_markdown) VALUES ($1, $2, $3, $4)",
            [profileId, 'cover_letter', jobDescription, parsed.coverLetter]
        );
    }
    if (parsed.employerAnswers) {
        await pool.query(
            "INSERT INTO cv_versions (user_profile_id, version_type, job_description, raw_markdown) VALUES ($1, $2, $3, $4)",
            [profileId, 'job_qa', jobDescription, parsed.employerAnswers]
        );
    }
        
    res.json(parsed);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/improve", async (req, res) => {
  try {
    const { profileId, instruction, currentCv } = req.body;
    if (!profileId) return res.status(404).json({error: "Profile missing"});
    const profileRes = await pool.query("SELECT * FROM user_profiles WHERE id = $1", [profileId]);
    const profile = profileRes.rows[0];
    if (!profile) return res.status(404).json({ error: "Profile missing" });

    const summarySearch = await pool.query(`
            SELECT p.repo_name, e.chunk_text
            FROM project_embeddings e
            JOIN projects_raw_text p ON p.id = e.project_id
            WHERE p.user_profile_id = $1
            ORDER BY RANDOM() LIMIT 8
        `, [profileId]);

    let context = summarySearch.rows.map((r: any) => `Repo: ${r.repo_name}\n${r.chunk_text}`).join("\n\n");
    const prompt = `You are a strict, top-tier technical CV reviewer. 
The candidate is trying to improve their Base CV. They have an interview profile and some raw architectural data from their projects.

Candidate Demographics (Interview Memory):
${JSON.stringify(profile.demographics_json)}

Original CV Context (Mega CV if available, otherwise Base CV):
${currentCv || profile.extended_cv || profile.base_cv}

Sample RAG Architecture Contexts from their internal monorepos:
${context}

${instruction ? `\n# STRICT OPTIONAL INSTRUCTION FROM USER:\n${instruction}\nYOU MUST ADHERE TO THIS TARGET DIRECTIVE.` : ''}

Output ONLY the raw markdown of the rewritten, elite-tier CV. 
Focus on:
1. Translating passive voice to strong action verbs (Architected, Engineered, Spearheaded).
2. Quantifying achievements (if deducible).
3. Condensing fluff into high-signal engineering impact.`;

    const generation = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });

    const rawMarkdown = generation.text?.trim() || "";
        
    await pool.query(
         "INSERT INTO cv_versions (user_profile_id, version_type, raw_markdown) VALUES ($1, $2, $3)",
         [profileId, 'improved_base', rawMarkdown]
    );
        
    res.json({ improvedCv: rawMarkdown });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(3001, () => {
    console.log("Command Center Backend listening on port 3001");
  });
}

export default app;
