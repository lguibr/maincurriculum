import { initDB } from "./core";
import type { UserProfile } from "./types";

export const profileOps = {
  async getProfile(id: string = "main") {
    const db = await initDB();
    return db.get("profiles", id);
  },
  async saveProfile(profile: UserProfile) {
    const db = await initDB();
    return db.put("profiles", profile);
  },
  async getBaseCv() {
    const prof = await this.getProfile("main");
    return prof?.base_cv || "";
  },
};
