import { openDB } from "idb";
async function run() {
  const db = await openDB("CurriculumDB", 1);
  const exps = await db.getAll("experiences");
  console.log(JSON.stringify(exps, null, 2));
}
run();
