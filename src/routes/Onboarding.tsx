import { User } from "lucide-react";
import { submitAnswer } from "../actions/pipelineActions";
import { EntityDashboard } from "../components/EntityDashboard";
import { AsciiBackground } from "../components/ui/AsciiBackground";

import { useOnboardingFlow } from "../hooks/useOnboardingFlow";
import { ConfigStep } from "../features/onboarding/components/ConfigStep";
import { RepoSelector } from "../features/onboarding/components/RepoSelector";
import { IngestionStep } from "../features/onboarding/components/IngestionStep";
import { CvSubmissionStep } from "../features/onboarding/components/CvSubmissionStep";
import { UnifiedOrchestratorStep } from "../features/onboarding/components/UnifiedOrchestratorStep";
import { OnboardingHeader } from "../features/onboarding/components/OnboardingHeader";

export default function Onboarding() {
  const {
    baseCv, setBaseCv, githubUsername, setGithubUsername,
    githubAvatarUrl, githubBio, extendedCv, currentPhase, isWizardComplete,
    progress, currentQuestion, interviewHistory, targetRepos, reposProgress,
    wizardPhase, fetchedRepos, selectedRepoUrls, setSelectedRepoUrls, isFetchingRepos,
    githubToken, setGithubToken, geminiToken, setGeminiToken,
    handleHardReset, handleFetchRepos, handleStartIngestion, handleSubmitCV
  } = useOnboardingFlow();

  return (
    <div className="min-h-screen text-foreground flex flex-col font-sans selection:bg-primary/30 h-screen overflow-hidden text-sm relative">
      <AsciiBackground />
      <OnboardingHeader
        githubAvatarUrl={githubAvatarUrl}
        githubUsername={githubUsername}
        githubBio={githubBio}
        wizardPhase={wizardPhase}
        isWizardComplete={isWizardComplete}
        handleHardReset={handleHardReset}
      />

      <main className="flex-1 overflow-hidden p-6 flex flex-col items-center z-10 relative">
        <div className={`w-full flex-1 flex flex-col gap-6 min-h-0 transition-all duration-500 ${wizardPhase === 4 ? "max-w-[1600px]" : "max-w-4xl"}`}>
          <div className="w-full flex-1 flex flex-col bg-background/40 backdrop-blur-2xl border border-border/50 rounded-2xl overflow-hidden shadow-2xl min-h-0">
            <div className={`p-5 border-b border-border/50 bg-background/60 shrink-0 ${wizardPhase === 1 ? "hidden" : ""}`}>
              <h2 className="font-semibold text-base flex items-center">
                <User className="w-5 h-5 mr-3 text-primary" /> Context Setup
              </h2>
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative border-0 bg-transparent">
              {wizardPhase === 1 && (
                fetchedRepos.length === 0 ? (
                  <ConfigStep
                    githubUsername={githubUsername} setGithubUsername={setGithubUsername}

                    handleFetchRepos={handleFetchRepos} isFetchingRepos={isFetchingRepos}
                    githubToken={githubToken} setGithubToken={setGithubToken}
                    geminiToken={geminiToken} setGeminiToken={setGeminiToken}
                  />
                ) : (
                  <RepoSelector
                    fetchedRepos={fetchedRepos}
                    selectedRepoUrls={selectedRepoUrls} setSelectedRepoUrls={setSelectedRepoUrls}
                    handleStartIngestion={handleStartIngestion} geminiToken={geminiToken}
                  />
                )
              )}

              {wizardPhase === 2 && (
                <IngestionStep
                  currentPhase={currentPhase} progress={progress}
                  targetRepos={targetRepos} reposProgress={reposProgress}
                />
              )}

              {wizardPhase === 3 && (
                <CvSubmissionStep
                  baseCv={baseCv} setBaseCv={setBaseCv} handleSubmitCV={handleSubmitCV}
                />
              )}

              {wizardPhase === 4 && (
                <div className="flex-1 flex min-h-0 bg-transparent overflow-hidden relative">
                  <div className="w-1/3 min-w-[350px] border-r border-border/50 bg-background/30 h-full flex flex-col overflow-hidden hidden md:flex">
                    <EntityDashboard />
                  </div>
                  <div className="flex-1 p-6 flex flex-col justify-start min-h-0 bg-transparent overflow-hidden relative">
                    <UnifiedOrchestratorStep
                      isWizardComplete={isWizardComplete} extendedCv={extendedCv}
                      currentQuestion={currentQuestion} currentPhase={currentPhase}
                      progress={progress}
                      interviewHistory={interviewHistory as any} submitAnswer={submitAnswer}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
