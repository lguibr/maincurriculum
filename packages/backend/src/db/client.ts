import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "maincurriculum",
});

// Helper validation query
export async function testDbConnection() {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("Database connected natively:", res.rows[0].now);
  } catch (e) {
    console.error("Database connection failed", e);
  }
}
