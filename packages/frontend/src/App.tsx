import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Onboarding from "./routes/Onboarding";
import Dashboard from "./routes/Dashboard";
import Tailor from "./routes/Tailor";
import Improve from "./routes/Improve";
import Memory from "./routes/Memory";
import { useStore } from "./store/useStore";

export default function App() {
  const isWizardComplete = useStore((state) => state.isWizardComplete);
  const setIsWizardComplete = useStore((state) => state.setIsWizardComplete);

  useEffect(() => {
    if (!isWizardComplete) {
       fetch(`http://${window.location.hostname}:3001/api/profile/latest`)
         .then(r => r.json())
         .then(d => {
             if (d && d.id) {
                setIsWizardComplete(true);
             }
         }).catch(() => {});
    }
  }, [isWizardComplete, setIsWizardComplete]);

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/onboarding" 
          element={<Onboarding />} 
        />
        
        <Route 
          path="/" 
          element={isWizardComplete ? <Dashboard /> : <Navigate to="/onboarding" />}
        >
          <Route index element={<Tailor />} />
          <Route path="tailor" element={<Tailor />} />
          <Route path="improve" element={<Improve />} />
          <Route path="memory" element={<Memory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
