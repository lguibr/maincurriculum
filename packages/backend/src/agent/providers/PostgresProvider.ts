import { IPersistenceProvider } from "./interfaces";
import { pool } from "../../db/client";

export class PostgresProvider implements IPersistenceProvider {
  async executeQuery(query: string, values: any[]): Promise<any> {
    const res = await pool.query(query, values);
    return res.rows;
  }
}
