import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Onboarding from "./routes/Onboarding";
import Dashboard from "./routes/Dashboard";
import Tailor from "./routes/Tailor";
import Improve from "./routes/Improve";
import Memory from "./routes/Memory";
import { usePipelineStore } from "./store/usePipelineStore";
import { dbOps } from "./db/indexedDB";

export default function App() {
  const isWizardComplete = usePipelineStore((state) => state.isWizardComplete);
  const setIsWizardComplete = usePipelineStore((state) => state.setIsWizardComplete);

  useEffect(() => {
    if (!isWizardComplete) {
      dbOps
        .getProfile("main")
        .then((d) => {
          if (d && d.extended_cv && d.extended_cv.length > 50) {
            setIsWizardComplete(true);
          }
        })
        .catch((e) => console.error("Could not fetch profile", e));
    }
  }, [isWizardComplete, setIsWizardComplete]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />

        <Route path="/" element={isWizardComplete ? <Dashboard /> : <Navigate to="/onboarding" />}>
          <Route index element={<Tailor />} />
          <Route path="tailor" element={<Tailor />} />
          <Route path="improve" element={<Improve />} />
          <Route path="memory" element={<Memory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
