import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface UserProfile {
  id: string; // usually default "main"
  github_handle: string;
  base_cv: string;
  extended_cv: string;
  demographics_json: any;
  interview_history?: { q: string; a: string }[];
  created_at: number;
}

export interface Skill {
  id: string; // generated uuid or sanitized name
  name: string;
  type: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  start_date: string;
  end_date: string;
  description: string;
  skills: string[]; // skill IDs
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface Project {
  id: string;
  repo_name: string;
  raw_text: string;
  skills: string[]; // skill IDs
  last_synced_at?: number; // timestamp for delta sync
}

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  job_description: string;
  tailored_cv: string;
  cover_letter: string;
  qa_prep: string;
  created_at: number;
}

export interface ProjectChunkEmbedding {
  id: string;
  project_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[]; // e.g. 768 or 384 numbers from EmbeddingGemma
}

interface CurriculumDB extends DBSchema {
  profiles: {
    key: string;
    value: UserProfile;
  };
  skills: {
    key: string;
    value: Skill;
  };
  experiences: {
    key: string;
    value: Experience;
  };
  educations: {
    key: string;
    value: Education;
  };
  projects: {
    key: string;
    value: Project;
  };
  embeddings: {
    key: string;
    value: ProjectChunkEmbedding;
    indexes: { "by-project": string };
  };
  job_applications: {
    key: string;
    value: JobApplication;
  };
}

let dbPromise: Promise<IDBPDatabase<CurriculumDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<CurriculumDB>("CurriculumDB", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("profiles"))
          db.createObjectStore("profiles", { keyPath: "id" });
        if (!db.objectStoreNames.contains("skills"))
          db.createObjectStore("skills", { keyPath: "id" });
        if (!db.objectStoreNames.contains("experiences"))
          db.createObjectStore("experiences", { keyPath: "id" });
        if (!db.objectStoreNames.contains("educations"))
          db.createObjectStore("educations", { keyPath: "id" });
        if (!db.objectStoreNames.contains("projects"))
          db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("embeddings")) {
          const embStore = db.createObjectStore("embeddings", { keyPath: "id" });
          embStore.createIndex("by-project", "project_id");
        }
        if (!db.objectStoreNames.contains("job_applications"))
          db.createObjectStore("job_applications", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
};

// --- Helpers for simplified usage ---

export const dbOps = {
  async getProfile(id: string = "main") {
    const db = await initDB();
    return db.get("profiles", id);
  },
  async saveProfile(profile: UserProfile) {
    const db = await initDB();
    await db.put("profiles", profile);
  },

  async saveSkill(skill: Skill) {
    const db = await initDB();
    const all = await db.getAll("skills");
    const dup = all.find(s => s.name.toLowerCase() === skill.name.toLowerCase() && s.id !== skill.id);
    if (dup) {
      skill = { ...dup, ...skill };
      skill.id = dup.id;
    }
    await db.put("skills", skill);
  },
  async getSkills() {
    const db = await initDB();
    return db.getAll("skills");
  },

  async saveExperience(exp: Experience) {
    const db = await initDB();
    const all = await db.getAll("experiences");
    const dup = all.find(e => e.company === exp.company && e.role === exp.role && e.id !== exp.id);
    if (dup) {
      exp = { ...dup, ...exp };
      exp.id = dup.id; // ensure ID is preserved
    }
    await db.put("experiences", exp);
  },
  async getExperiences() {
    const db = await initDB();
    return db.getAll("experiences");
  },

  async deleteExperience(id: string) {
    const db = await initDB();
    await db.delete("experiences", id);
  },

  async deleteSkill(id: string) {
    const db = await initDB();
    await db.delete("skills", id);
  },

  async saveProject(proj: Project) {
    const db = await initDB();
    const all = await db.getAll("projects");
    const dup = all.find(p => p.repo_name === proj.repo_name && p.id !== proj.id);
    if (dup) {
      proj = { ...dup, ...proj };
      proj.id = dup.id;
    }
    await db.put("projects", proj);
  },
  async getProjects() {
    const db = await initDB();
    return db.getAll("projects");
  },
  async deleteProject(id: string) {
    const db = await initDB();
    await db.delete("projects", id);
  },

  async saveEducation(edu: Education) {
    const db = await initDB();
    const all = await db.getAll("educations");
    const dup = all.find(e => e.school === edu.school && e.degree === edu.degree && e.id !== edu.id);
    if (dup) edu.id = dup.id;
    await db.put("educations", edu);
  },
  async getEducations() {
    const db = await initDB();
    return db.getAll("educations");
  },
  async deleteEducation(id: string) {
    const db = await initDB();
    await db.delete("educations", id);
  },

  async saveEmbedding(emb: ProjectChunkEmbedding) {
    const db = await initDB();
    await db.put("embeddings", emb);
  },
  async getEmbeddingsByProject(projectId: string) {
    const db = await initDB();
    return db.getAllFromIndex("embeddings", "by-project", projectId);
  },

  // Manual cosine similarity for retrieval
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  // Basic vector search
  async searchSimilarChunks(queryVector: number[], topK: number = 3) {
    const db = await initDB();
    const all = await db.getAll("embeddings");

    const scored = all.map((vec) => ({
      chunk: vec,
      score: this.cosineSimilarity(queryVector, vec.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.chunk);
  },

  async saveJobApplication(app: JobApplication) {
    const db = await initDB();
    await db.put("job_applications", app);
  },
  async getJobApplications() {
    const db = await initDB();
    return db.getAll("job_applications");
  },
  async deleteJobApplication(id: string) {
    const db = await initDB();
    await db.delete("job_applications", id);
  }
};
