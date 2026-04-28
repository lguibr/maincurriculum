import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Onboarding from "./routes/Onboarding";
import Dashboard from "./routes/Dashboard";
import Tailor from "./routes/Tailor";
import Improve from "./routes/Improve";
import Memory from "./routes/Memory";
import Timeline from "./routes/Timeline";
import Home from "./routes/Home";
import JobApplication from "./routes/JobApplication";
import { usePipelineStore } from "./store/usePipelineStore";
import { useProfileStore } from "./store/useProfileStore";
import { dbOps } from "./db/indexedDB";
import { Loader2 } from "lucide-react";

export default function App() {
  const isWizardComplete = usePipelineStore((state) => state.isWizardComplete);
  const setIsWizardComplete = usePipelineStore((state) => state.setIsWizardComplete);
  const setGithubAvatarUrl = useProfileStore((s) => s.setGithubAvatarUrl);
  const setGithubBio = useProfileStore((s) => s.setGithubBio);
  const setGithubUsername = useProfileStore((s) => s.setGithubUsername);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const avatar = localStorage.getItem("GITHUB_AVATAR");
    const bio = localStorage.getItem("GITHUB_BIO");
    const handle = localStorage.getItem("GITHUB_HANDLE");
    if (avatar) setGithubAvatarUrl(avatar);
    if (bio) setGithubBio(bio);
    if (handle) setGithubUsername(handle);

    dbOps
      .getProfile("main")
      .then((d) => {
        if (d && d.extended_cv && d.extended_cv.length > 50) {
          setIsWizardComplete(true);
        }
      })
      .catch((e) => console.error("Could not fetch profile", e))
      .finally(() => setIsInitializing(false));
  }, [setIsWizardComplete]);

  if (isInitializing) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-muted-foreground animate-pulse">Initializing Interface...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />

        <Route path="/" element={isWizardComplete ? <Dashboard /> : <Navigate to="/onboarding" />}>
          <Route index element={<Home />} />
          <Route path="tailor" element={<Tailor />} />
          <Route path="improve" element={<Improve />} />
          <Route path="memory" element={<Memory />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="jobs/:company/:role" element={<JobApplication />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
