import { initDB } from "./core";
import type { JobApplication } from "./types";
import { v4 as uuidv4 } from "uuid";

export const catalogOps = {
  // --- Job Applications (Catalog) ---
  async getJobApplications(): Promise<JobApplication[]> {
    const db = await initDB();
    const apps = await db.getAll("job_applications");
    return apps.sort((a, b) => b.created_at - a.created_at);
  },
  async getJobApplication(id: string): Promise<JobApplication | undefined> {
    const db = await initDB();
    return db.get("job_applications", id);
  },
  async saveJobApplication(app: Partial<JobApplication>): Promise<string> {
    const db = await initDB();
    const id = app.id || uuidv4();
    
    let existing;
    if (app.id) {
        existing = await db.get("job_applications", app.id);
    }
    
    const finalApp = {
        id,
        company: app.company || existing?.company || "Unknown",
        role: app.role || existing?.role || "Unknown",
        job_description: app.job_description || existing?.job_description || "",
        tailored_cv: app.tailored_cv || existing?.tailored_cv || "",
        cover_letter: app.cover_letter || existing?.cover_letter || "",
        qa_prep: app.qa_prep || existing?.qa_prep || "",
        created_at: existing?.created_at || Date.now()
    };
    
    await db.put("job_applications", finalApp);
    return id;
  },
  async deleteJobApplication(id: string): Promise<void> {
    const db = await initDB();
    await db.delete("job_applications", id);
  }
};
