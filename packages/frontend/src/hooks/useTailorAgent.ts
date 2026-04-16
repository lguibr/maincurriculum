import { useState } from 'react';
import { appGraph } from '../agent/graph';

export function useTailorAgent() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ node: string; message: string }[]>([]);
  const [activeNodes, setActiveNodes] = useState<string[]>([]);
  const [streamingTokens, setStreamingTokens] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ cv: string; coverLetter: string; answers?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTailor = async (jobDescription: string, baseCv: string, githubUsername: string, companyQuestions: string = "") => {
    if (!jobDescription || !baseCv || !githubUsername) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsRunning(true);
    setError(null);
    setProgress([]);
    setResult(null);
    setActiveNodes([]);
    setStreamingTokens({});

    const addProgress = (msg: string) => setProgress(p => [...p, { node: 'System', message: msg }]);

    try {
      addProgress("Fetching GitHub portfolio...");
      const res = await fetch(`https://api.github.com/users/${githubUsername}/repos?per_page=100&sort=updated`);
      if (!res.ok) throw new Error("Failed to fetch GitHub repositories. Check the username.");
      const repos = await res.json();
      addProgress(`Found ${repos.length} repositories.`);

      const initialState = {
        job_description: jobDescription,
        base_cv: baseCv,
        github_portfolio: repos,
        jd_analysis: {},
        selected_projects: [],
        repo_deep_dives: {},
        draft_cv: "",
        draft_cover_letter: "",
        company_questions: companyQuestions,
        draft_answers: "",
        critique_truth: "",
        critique_star: "",
        critique_verbosity: "",
        critique_tone: "",
        critique_feedback: "",
        next_action: "",
        iterations: 0
      };

      addProgress("Starting Agentic Workflow...");
      
      const newThreadId = Math.random().toString(36).substring(7);
      const config = {
        configurable: {
          thread_id: newThreadId,
          onChunk: (nodeName: string, text: string) => {
            setStreamingTokens(prev => ({
              ...prev,
              [nodeName]: (prev[nodeName] || '') + text
            }));
          }
        }
      };

      const stream = await appGraph.streamEvents(initialState, { ...config, version: "v2", recursionLimit: 150 });
      
      // We will also use the standard .stream() loop for node completion events
      // Wait, .streamEvents captures EVERYTHING. Let's use standard .stream() but passing config!
      // In graph runner it is actually appGraph.stream(initialState, config)
      
      const graphStream = await appGraph.stream(initialState, { ...config, recursionLimit: 150 });

      for await (const event of graphStream) {
        // Event is an object with node name as key
        const nodeNames = Object.keys(event);
        setActiveNodes(nodeNames);
        
        for (const nodeName of nodeNames) {
          const stepState = (event as Record<string, any>)[nodeName];
          
          if (nodeName === "Analyze_JD") addProgress("Analyzed Job Description. Extracted core skills.");
          else if (nodeName === "Profile_Match") addProgress(`Matched Profile. Selected projects: ${stepState.selected_projects?.join(", ")}`);
          else if (nodeName === "Fetch_Repo_Context") addProgress("Fetched deep context from selected repositories.");
          else if (nodeName === "Draft_Docs") addProgress(`Drafted CV and Cover Letter (Iteration ${stepState.iterations}).`);
          else if (nodeName.startsWith("Critique_")) {
            addProgress(`${nodeName} completed evaluation.`);
          }
        }
      }

      const finalGraphState = await appGraph.getState(config);
      if (finalGraphState && finalGraphState.values.draft_cv) {
        setResult({ 
          cv: finalGraphState.values.draft_cv, 
          coverLetter: finalGraphState.values.draft_cover_letter,
          answers: finalGraphState.values.draft_answers
        });
        addProgress("Workflow Complete!");
        setActiveNodes(["END"]);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during execution.");
      addProgress("Workflow failed.");
    } finally {
      setIsRunning(false);
    }
  };

  return {
    runTailor,
    isRunning,
    progress,
    activeNodes,
    streamingTokens,
    result,
    error,
    setError
  };
}
