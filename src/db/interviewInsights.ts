import { initDB } from "./core";
import { InterviewInsight } from "./types";

export const insightOps = {
  getInterviewInsights: async (): Promise<InterviewInsight[]> => {
    const db = await initDB();
    if (!db) return [];
    return db.getAll("interview_insights");
  },
  saveInterviewInsight: async (insight: InterviewInsight): Promise<void> => {
    const db = await initDB();
    if (!db) return;
    await db.put("interview_insights", insight);
  },
  deleteInterviewInsight: async (id: string): Promise<void> => {
    const db = await initDB();
    if (!db) return;
    await db.delete("interview_insights", id);
  },
};
