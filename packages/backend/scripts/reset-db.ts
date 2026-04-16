import { pool } from "../src/db/client.js";

async function resetDb() {
  console.log("⚠️  WARNING: Resetting entirely local AI Curriculum Database...");
  // Safely truncate all tables and restart identities.
  // Cascade drops dependent rows in relationships.
  try {
    await pool.query(`
      TRUNCATE TABLE 
        cv_versions, 
        project_embeddings, 
        projects_raw_text, 
        user_profiles 
      RESTART IDENTITY CASCADE;
    `);
    console.log("✅ Database successfully wiped clean. Ready for a new Onboard!");
  } catch (error) {
    console.error("❌ Failed to truncate databases:", error);
  } finally {
    pool.end();
  }
}

resetDb();
