const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgres://postgres:postgres@localhost:5432/maincurriculum",
});
async function check() {
  const r = await pool.query(
    "SELECT demographics_json FROM user_profiles ORDER BY id DESC LIMIT 1"
  );
  const p = r.rows[0].demographics_json.projects;
  console.log(p.map((x) => x.name).join(", "));
  pool.end();
}
check();
