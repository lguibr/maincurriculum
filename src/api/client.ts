import {
  IngestStartRequest,
  IngestAnswerRequest,
  ImproverChatRequest,
  TailorRequest,
  TailorResponse,
  UpdateProfileRequest,
  UpdateExtendedProfileRequest,
  ImproveRequest,
} from "@/shared";

const API_BASE = `http://${window?.location?.hostname}:3001/api`;

export const api = {
  ingest: {
    start: async (payload: IngestStartRequest) => {
      const res = await fetch(`${API_BASE}/ingest/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to start ingestion");
      return res.json();
    },
    answer: async (payload: IngestAnswerRequest) => {
      const res = await fetch(`${API_BASE}/ingest/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit answer");
      return res.json();
    },
    getStreamUrl: () => `${API_BASE}/ingest/stream`,
  },
  improver: {
    chat: async (payload: ImproverChatRequest) => {
      const res = await fetch(`${API_BASE}/improver/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to send improver chat");
      return res.json();
    },
    improveBase: async (payload: ImproveRequest) => {
      const res = await fetch(`${API_BASE}/improver/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to improve base CV");
      return res.json();
    },
  },
  profile: {
    getLatest: async () => {
      const res = await fetch(`${API_BASE}/profile/latest`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to get profile");
      return res.json();
    },
    update: async (id: string | number, payload: UpdateProfileRequest) => {
      const res = await fetch(`${API_BASE}/profile/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    updateExtended: async (id: string | number, payload: UpdateExtendedProfileRequest) => {
      const res = await fetch(`${API_BASE}/profile/${id}/extended`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update extended profile");
      return res.json();
    },
  },
  tailor: {
    generate: async (payload: TailorRequest): Promise<TailorResponse> => {
      const res = await fetch(`${API_BASE}/tailor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to tailor CV");
      return res.json();
    },
  },
  github: {
    getRepos: async (handle: string) => {
      const res = await fetch(`${API_BASE}/github/repos/${handle}`);
      if (!res.ok) throw new Error("Failed to get repos");
      return res.json();
    },
  },
  system: {
    reset: async () => {
      const res = await fetch(`${API_BASE}/reset`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to reset database");
      return res.json();
    },
  },
  entities: {
    get: async (userProfileId: string | number) => {
      const res = await fetch(`${API_BASE}/entities/${userProfileId}`);
      if (!res.ok) throw new Error("Failed to get entities");
      return res.json();
    },
    deleteExperience: async (id: string | number) => {
      const res = await fetch(`${API_BASE}/entities/experience/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete experience");
      return res.json();
    },
    deleteSkill: async (id: string | number) => {
      const res = await fetch(`${API_BASE}/entities/skill/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete skill");
      return res.json();
    },
  },
};
