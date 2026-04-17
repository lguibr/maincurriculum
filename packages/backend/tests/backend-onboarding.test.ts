import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/server";
import { pool } from "../src/db/client";

// Global Vitest Mocks for External Services
vi.mock("../src/db/client", () => {
  return {
    pool: {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      end: vi.fn(),
    },
  };
});

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'mock_generation',
        }),
        embedContent: vi.fn().mockResolvedValue({ embeddings: [{ values: [0.1, 0.2, 0.3] }] }),
      },
    })),
  };
});describe("Suite X: Backend Onboarding Integration (SSE Flows)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("X1. Captures Server-Sent Events from /api/ingest/stream upon start", async () => {
    // For testing SSE with Supertest + Express, we must initiate the stream and wait.
    // However, vitest needs a way to close it or it will hang.
    const chunks: string[] = [];
    
    // We create an isolated promise to consume the stream
    const consumeStream = new Promise<void>((resolve, reject) => {
      const req = request(app).get("/api/ingest/stream").buffer(false);
      req.end((err, res) => {
        if (err) reject(err);
      });
      req.on('response', (res) => {
        res.on('data', (chunk: any) => {
          const str = chunk.toString();
          chunks.push(str);
          // If we receive the error because we're using a dummy key, or it completes
          if (str.includes('"type":"complete"') || str.includes('"type":"interrupt"') || str.includes('ERROR:')) {
             res.destroy(); // Break the connection intentionally
             resolve();
          }
        });
        res.on('end', () => resolve());
      });
    });

    // Fire the POST command which writes to the active stream
    await request(app)
      .post("/api/ingest/start")
      .send({ githubUrl: "https://github.com/test/repo", baseCv: "Developer CV" })
      .expect(200);

    // Wait for the stream consumer to see an end event (either interrupt or complete or error)
    await consumeStream;

    // Verify it received connected event and handled the stream gracefully
    const fullLog = chunks.join("");
    expect(fullLog).toContain('"type":"connected"');
    expect(fullLog.length).toBeGreaterThan(0);
  }, 15000); // give it some time since LangGraph builds locally

  it("X2. Can hit /api/ingest/answer to resume an interrupted pipeline", async () => {
    const res = await request(app)
      .post("/api/ingest/answer")
      .send({ answer: "I have 5 years of DevOps experience." });
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Answer received");
  });
});
