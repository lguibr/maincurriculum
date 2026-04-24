import { initDB } from "./core";
import type { Skill, Experience, Education, Project, ProjectChunkEmbedding } from "./types";
import { v4 as uuidv4 } from "uuid";

export const entityOps = {
  // --- Skills ---
  async getSkills() {
    const db = await initDB();
    return db.getAll("skills");
  },
  async getSkill(id: string) {
    const db = await initDB();
    return db.get("skills", id);
  },
  async saveSkill(skill: Skill) {
    const db = await initDB();
    if (!skill.id) skill.id = skill.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return db.put("skills", skill);
  },
  async deleteSkill(id: string) {
    const db = await initDB();
    return db.delete("skills", id);
  },

  // --- Experiences ---
  async getExperiences() {
    const db = await initDB();
    return db.getAll("experiences");
  },
  async getExperience(id: string) {
    const db = await initDB();
    return db.get("experiences", id);
  },
  async saveExperience(exp: Experience) {
    const db = await initDB();
    if (!exp.id) exp.id = uuidv4();
    const existing = await db.get("experiences", exp.id);
    const mExp = existing ? { ...existing, ...exp, skills: Array.from(new Set([...(existing.skills || []), ...(exp.skills || [])])) } : exp;
    return db.put("experiences", mExp);
  },
  async deleteExperience(id: string) {
    const db = await initDB();
    return db.delete("experiences", id);
  },

  // --- Educations ---
  async getEducations() {
    const db = await initDB();
    return db.getAll("educations");
  },
  async getEducation(id: string) {
    const db = await initDB();
    return db.get("educations", id);
  },
  async saveEducation(edu: Education) {
    const db = await initDB();
    if (!edu.id) edu.id = uuidv4();
    const existing = await db.get("educations", edu.id);
    const mEdu = existing ? { ...existing, ...edu } : edu;
    return db.put("educations", mEdu);
  },
  async deleteEducation(id: string) {
    const db = await initDB();
    return db.delete("educations", id);
  },

  // --- Projects ---
  async getProjects() {
    const db = await initDB();
    return db.getAll("projects");
  },
  async getProject(id: string) {
    const db = await initDB();
    return db.get("projects", id);
  },
  async saveProject(proj: Project) {
    const db = await initDB();
    if (!proj.id) proj.id = proj.repo_name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = await db.get("projects", proj.id);
    const mProj = existing ? { ...existing, ...proj, skills: Array.from(new Set([...(existing.skills || []), ...(proj.skills || [])])) } : proj;
    return db.put("projects", mProj);
  },
  async deleteProject(id: string) {
    const db = await initDB();
    return db.delete("projects", id);
  },

  // --- Embeddings ---
  async getProjectEmbeddings(projectId: string) {
    const db = await initDB();
    return db.getAllFromIndex("embeddings", "by-project", projectId);
  },
  async saveEmbedding(emb: ProjectChunkEmbedding) {
    const db = await initDB();
    return db.put("embeddings", emb);
  },
};
