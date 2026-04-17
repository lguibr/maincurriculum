import { describe, it, expect, vi, beforeEach } from "vitest";
import { persisterNode } from "../src/agent/nodes/persister";
import { pool } from "../src/db/client";

// Global Mock
vi.mock("../src/db/client", () => ({
  pool: {
    query: vi.fn(),
    end: vi.fn(),
  },
}));

describe("Persister Node Fallback Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Resolves projectId from cache synchronously on same tick", async () => {
    (pool.query as any).mockResolvedValueOnce({ rows: [] }); // For DELETE
    (pool.query as any).mockResolvedValueOnce({ rows: [{ id: 999 }] }); // For upsert INSERT
    (pool.query as any).mockResolvedValueOnce({ rows: [] }); // For insert embedding

    const state: any = {
      userProfileId: 100,
      pendingDbWrites: [
        {
          action: "upsert",
          targetTable: "projects_raw_text",
          data: { repo_name: "test/repo1", raw_text: "abc" }
        },
        {
          action: "insert",
          targetTable: "project_embeddings",
          data: { _repoNameRef: "test/repo1", chunk_text: "abc" } // Should hit cache
        }
      ]
    };

    const res = await persisterNode(state, { callbacks: [] });
    // Expected 3 calls: DELETE, INSERT raw_text, INSERT embeddings
    expect(pool.query).toHaveBeenCalledTimes(3);
    const insertMock = (pool.query as any).mock.calls[2];
    expect(insertMock[0]).toContain("INSERT INTO project_embeddings");
    expect(insertMock[1][0]).toBe(999); // Map fallback used
    expect(res.pendingDbWrites).toEqual([]);
  });

  it("2. Falls back to DB query asynchronously on separated tick", async () => {
    // Only the embedding arrives. It should hit the fallback lookup query
    (pool.query as any).mockResolvedValueOnce({ rows: [{ id: 777 }] }); // The fallback lookup SELECT id
    (pool.query as any).mockResolvedValueOnce({ rows: [] }); // The actual INSERT project_embeddings

    const state: any = {
      userProfileId: 100,
      pendingDbWrites: [
        {
          action: "insert",
          targetTable: "project_embeddings",
          data: { _repoNameRef: "test/repo-separated", chunk_text: "xyz" } 
        }
      ]
    };

    await persisterNode(state, { callbacks: [] });
    
    // First query should be the fallback lookup
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect((pool.query as any).mock.calls[0][0]).toContain("SELECT id FROM projects_raw_text");
    expect((pool.query as any).mock.calls[0][1]).toEqual([100, "test/repo-separated"]);

    // Second query is the insertion with the resolved ID 777
    expect((pool.query as any).mock.calls[1][0]).toContain("INSERT INTO project_embeddings");
    expect((pool.query as any).mock.calls[1][1][0]).toBe(777);
  });

  it("3. Gracefully rejects gracefully if the repoName reference does not exist", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (pool.query as any).mockResolvedValueOnce({ rows: [] }); // Empty lookup

    const state: any = {
      userProfileId: 100,
      pendingDbWrites: [
        {
          action: "insert",
          targetTable: "project_embeddings",
          data: { _repoNameRef: "test/missing", chunk_text: "xyz" } 
        }
      ]
    };

    await persisterNode(state, { callbacks: [] });

    expect(pool.query).toHaveBeenCalledTimes(1); // Only lookup executed
    expect(errorSpy).toHaveBeenCalledWith("[Persister] Missing project ID for embedding chunk");
    errorSpy.mockRestore();
  });

  it("4. Successfully uses default project_id if explicitly provided without ref", async () => {
    (pool.query as any).mockResolvedValueOnce({ rows: [] }); // The INSERT project_embeddings

    const state: any = {
      userProfileId: 100,
      pendingDbWrites: [
        {
          action: "insert",
          targetTable: "project_embeddings",
          data: { project_id: 888, chunk_text: "xyz" } // Explicit project_id
        }
      ]
    };

    await persisterNode(state, { callbacks: [] });
    
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect((pool.query as any).mock.calls[0][0]).toContain("INSERT INTO project_embeddings");
    expect((pool.query as any).mock.calls[0][1][0]).toBe(888);
  });
});
