import { DBSchema } from "idb";

export interface UserProfile {
  id: string; // usually default "main"
  github_handle: string;
  base_cv: string;
  extended_cv: string;
  demographics_json: any;
  interview_history?: { q: string; a: string; type?: "critique" | "interview" }[];
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
  name?: string;
  repo_name: string; // Used as fallback or GitHub identifier
  associated_context?: string; // Company or context where it was built
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
  project_id: string; // Used as generic reference ID (could be repo_name, experience id, etc)
  chunk_index: number;
  chunk_text: string;
  type?: "codebase" | "entity";
  entity_type?: "experience" | "education" | "project";
  embedding: number[]; // e.g. 768 or 384 numbers from EmbeddingGemma
}

export interface CurriculumDB extends DBSchema {
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
