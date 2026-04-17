import { ProfileGraphState } from "../state";
import { pool } from "../../db/client";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";

export async function persisterNode(state: ProfileGraphState, config?: RunnableConfig) {
  if (!state.pendingDbWrites || state.pendingDbWrites.length === 0) {
    return {};
  }

  await dispatchCustomEvent(
    "progress",
    { msg: `[Persister] Writing ${state.pendingDbWrites.length} transaction(s) to Database...` },
    config
  );

  let newUserProfileId = state.userProfileId;

  const repoToProjectId = new Map<string, number>();

  for (const directive of state.pendingDbWrites) {
    try {
      if (directive.action === "upsert" && directive.targetTable === "projects_raw_text" && newUserProfileId !== null) {
        // Clear any old data to simulate upsert without unique constraints
        await pool.query("DELETE FROM projects_raw_text WHERE user_profile_id = $1 AND repo_name = $2", [newUserProfileId, directive.data.repo_name]);
        const res = await pool.query(
          "INSERT INTO projects_raw_text (user_profile_id, repo_name, raw_text, file_count, repo_updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [newUserProfileId, directive.data.repo_name, directive.data.raw_text, directive.data.file_count || 1, directive.data.repo_updated_at]
        );
        repoToProjectId.set(directive.data.repo_name, res.rows[0].id);
      } else if (directive.action === "insert") {
        if (directive.targetTable === "project_embeddings") {
          const projectId = directive.data._repoNameRef ? repoToProjectId.get(directive.data._repoNameRef) : directive.data.project_id;
          if (!projectId) {
            console.error(`[Persister] Missing project ID for embedding chunk`);
            continue;
          }
          await pool.query(
            "INSERT INTO project_embeddings (project_id, chunk_index, chunk_text, embedding) VALUES ($1, $2, $3, $4)",
            [
              projectId,
              directive.data.chunk_index,
              directive.data.chunk_text,
              directive.data.embedding,
            ]
          );
        } else if (directive.targetTable === "user_profiles" && newUserProfileId === null) {
          const res = await pool.query(
            "INSERT INTO user_profiles (github_handle, base_cv) VALUES ($1, $2) RETURNING id",
            [directive.data.github_handle, directive.data.base_cv]
          );
          newUserProfileId = res.rows[0].id;
        }
      } else if (directive.action === "update") {
        if (directive.targetTable === "user_profiles" && newUserProfileId !== null) {
          if (directive.data.demographics_json) {
            await pool.query("UPDATE user_profiles SET demographics_json = $1 WHERE id = $2", [
              directive.data.demographics_json,
              newUserProfileId,
            ]);
          }
          if (directive.data.base_cv) {
            await pool.query("UPDATE user_profiles SET base_cv = $1 WHERE id = $2", [
              directive.data.base_cv,
              newUserProfileId,
            ]);
          }
          if (directive.data.extended_cv) {
            await pool.query("UPDATE user_profiles SET extended_cv = $1 WHERE id = $2", [
              directive.data.extended_cv,
              newUserProfileId,
            ]);
          }
        }
      }
    } catch (e: any) {
      console.error(`[Persister] Failed DB mapping for ${directive.targetTable}: ${e.message}`);
    }
  }

  // Clear the DB writes so they don't trigger again, and potentially update the userProfileId
  return {
    pendingDbWrites: [], // Note: Empty array to trigger reset via reducer logic
    userProfileId: newUserProfileId,
  };
}
