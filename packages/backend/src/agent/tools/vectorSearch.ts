import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "../../db/client";
import { EmbedderPipeline } from "../subgraphs/ingestion"; // re-use the same embedder singleton

export const searchGithubProjectsTool = tool(async ({ query, limit = 5 }) => {
    try {
        const embedder = await EmbedderPipeline.getInstance();
        const embeddingResult = await embedder(query, { pooling: 'mean', normalize: true });
        
        // Convert Float32Array to pgvector string format: '[val1, val2, ...]'
        const embeddingArray = Array.from(embeddingResult.data);
        const vectorString = '[' + embeddingArray.join(',') + ']';

        // Query pgvector for the closest chunks using cosine distance (<=>)
        // Join with projects_raw_text to get the repo_name
        const result = await pool.query(
            `
            SELECT 
                r.repo_name,
                e.chunk_text,
                (e.embedding <=> $1) as distance
            FROM project_embeddings e
            JOIN projects_raw_text r ON e.project_id = r.id
            ORDER BY distance ASC
            LIMIT $2
            `,
            [vectorString, limit]
        );

        if (result.rows.length === 0) {
            return "No relevant project context found for this query.";
        }

        return result.rows.map(row => 
            `\n--- Match from Repo: ${row.repo_name} (Distance: ${row.distance.toFixed(3)}) ---\n${row.chunk_text}\n`
        ).join("\n");

    } catch (e: any) {
        return `Error searching vector embeddings: ${e.message}`;
    }
}, { 
    name: "search_github_projects", 
    description: "Search across all user GitHub repositories using semantic vector search. Use this to find specific code implementations, project purposes, and verify technical claims.", 
    schema: z.object({ 
        query: z.string().describe("The semantic query or claim to search for (e.g. 'Used React with Redux for state management')"),
        limit: z.number().optional().describe("Number of context chunks to return (default is 5)")
    }) 
});

export const querySkillsAndExperiencesTool = tool(async ({ userProfileId }) => {
   try {
        const result = await pool.query(
            "SELECT demographics_json FROM user_profiles WHERE id = $1", 
            [userProfileId]
        );
        if (result.rows.length === 0 || !result.rows[0].demographics_json) {
            return "No demographic framework or skills available.";
        }
        return JSON.stringify(result.rows[0].demographics_json, null, 2);
   } catch (e: any) {
        return `Error fetching skills/demographics: ${e.message}`;
   }
}, {
    name: "query_skills_and_experiences",
    description: "Fetch the JSON ontology containing all the user's verified skills, past work experiences, and educational background.",
    schema: z.object({
        userProfileId: z.number().describe("The user profile ID to lookup")
    })
});
