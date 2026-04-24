import { openDB, IDBPDatabase } from "idb";
import type { CurriculumDB } from "./types";

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
