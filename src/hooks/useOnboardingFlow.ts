import { useState, useEffect } from "react";
import { useProfileStore } from "../store/useProfileStore";
import { usePipelineStore } from "../store/usePipelineStore";
import { useEntityStore } from "../store/useEntityStore";
import { useInterviewStore } from "../store/useInterviewStore";
import { startAgent, processCvAndInterview } from "../actions/pipelineActions";

export function useOnboardingFlow() {
  const {
    baseCv,
    setBaseCv,

    githubUsername,
    setGithubUsername,
    githubAvatarUrl,
    githubBio,
    extendedCv,
  } = useProfileStore();

  const { currentPhase, isRunning, isWizardComplete, progress } = usePipelineStore();
  const { currentQuestion, interviewHistory } = useInterviewStore();
  const { targetRepos, reposProgress } = useEntityStore();

  const [wizardPhase, setWizardPhase] = useState(1);
  const [fetchedRepos, setFetchedRepos] = useState<any[]>([]);
  const [selectedRepoUrls, setSelectedRepoUrls] = useState<string[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [geminiToken, setGeminiToken] = useState("");

  useEffect(() => {
    if (wizardPhase === 2 && !isRunning && currentPhase === "Complete") {
      setWizardPhase(3);
    }
  }, [isRunning, progress, wizardPhase, currentPhase]);

  useEffect(() => {
    setGithubToken(localStorage.getItem("GITHUB_TOKEN") || "");
    setGeminiToken(localStorage.getItem("GEMINI_API_KEY") || "");

    import("../db/indexedDB").then(({ dbOps }) => {
      dbOps.getProfile("main").then((prof) => {
        if (prof) {
          setGithubUsername(prof.github_handle || "");
          if (prof.base_cv && prof.base_cv.trim().length > 50) {
            setBaseCv(prof.base_cv);
            dbOps.getSkills().then((skills) => {
              if (skills && skills.length > 0) {
                setWizardPhase(3);
              }
            });
          }
        }
      });
    });
  }, []);

  const handleHardReset = async () => {
    if (!confirm("WARNING: This will completely nuke your local database. Proceed?")) return;
    const gToken = localStorage.getItem("GITHUB_TOKEN");
    const gemToken = localStorage.getItem("GEMINI_API_KEY");
    const ghHandle = localStorage.getItem("GITHUB_HANDLE") || githubUsername;
    const ghAvatar = localStorage.getItem("GITHUB_AVATAR");
    const ghBio = localStorage.getItem("GITHUB_BIO");

    localStorage.clear();

    if (gToken) localStorage.setItem("GITHUB_TOKEN", gToken);
    if (gemToken) localStorage.setItem("GEMINI_API_KEY", gemToken);
    if (ghHandle) localStorage.setItem("GITHUB_HANDLE", ghHandle);
    if (ghAvatar) localStorage.setItem("GITHUB_AVATAR", ghAvatar);
    if (ghBio) localStorage.setItem("GITHUB_BIO", ghBio);

    try {
      const { initDB } = await import("../db/indexedDB");
      const db = await initDB();
      db.close();

      const req = indexedDB.deleteDatabase("CurriculumDB");
      req.onsuccess = () => window.location.reload();
      req.onerror = () => window.location.reload();
      req.onblocked = () => window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  };

  const handleFetchRepos = async () => {
    if (!githubUsername) return;
    setIsFetchingRepos(true);
    try {
      const handle = githubUsername.split("/").pop();
      if (handle) localStorage.setItem("GITHUB_HANDLE", handle);

      const headers: Record<string, string> = {};
      const token = localStorage.getItem("GITHUB_TOKEN");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      try {
        const profRes = await fetch(`https://api.github.com/users/${handle}`, { headers });
        if (profRes.ok) {
          const profData = await profRes.json();
          useProfileStore.getState().setGithubAvatarUrl(profData.avatar_url || "");
          useProfileStore.getState().setGithubBio(profData.bio || "");
          if (profData.avatar_url) localStorage.setItem("GITHUB_AVATAR", profData.avatar_url);
          if (profData.bio) localStorage.setItem("GITHUB_BIO", profData.bio);
        }
      } catch (err) {}

      const res = await fetch(
        `https://api.github.com/users/${handle}/repos?type=owner&sort=updated&per_page=100`,
        { headers }
      );
      const repoData = await res.json();

      if (Array.isArray(repoData)) {
        setFetchedRepos(repoData.map((r: any) => ({
          name: r.full_name || r.name,
          url: r.html_url,
          description: r.description,
          updatedAt: r.updated_at,
          createdAt: r.created_at,
        })));
      } else {
        setFetchedRepos([]);
      }
      setSelectedRepoUrls([]);

      try {
        const { dbOps } = await import("../db/indexedDB");
        const profileData = await dbOps.getProfile("main");
        if (profileData && profileData.base_cv && profileData.base_cv.trim().length > 50) {
          setBaseCv(profileData.base_cv);
        }
      } catch (err) {}
    } catch (e) {
      console.error(e);
    }
    setIsFetchingRepos(false);
  };

  const handleStartIngestion = async () => {
    setWizardPhase(2);
    try {
      const selectedRepos = fetchedRepos.filter((r) => selectedRepoUrls.includes(r.url));
      await startAgent(selectedRepos);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitCV = async () => {
    setWizardPhase(4);
    try {
      await processCvAndInterview(baseCv);
    } catch (e) {
      console.error(e);
    }
  };

  return {
    baseCv, setBaseCv, githubUsername, setGithubUsername,
    githubAvatarUrl, githubBio, extendedCv, currentPhase, isRunning, isWizardComplete,
    progress, currentQuestion, interviewHistory, targetRepos, reposProgress,
    wizardPhase, fetchedRepos, selectedRepoUrls, setSelectedRepoUrls, isFetchingRepos,
    githubToken, setGithubToken, geminiToken, setGeminiToken,
    handleHardReset, handleFetchRepos, handleStartIngestion, handleSubmitCV
  };
}
