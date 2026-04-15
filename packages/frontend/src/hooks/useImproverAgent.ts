import { useState } from 'react';
import { cvImproverGraph } from '../agent/cvImproverGraph';

export function useImproverAgent() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ node: string; message: string }[]>([]);
  const [activeNodes, setActiveNodes] = useState<string[]>([]);
  const [streamingTokens, setStreamingTokens] = useState<Record<string, string>>({});
  
  const [score, setScore] = useState<number>(0);
  const [critique, setCritique] = useState<string>('');
  const [needsHumanInput, setNeedsHumanInput] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [threadId, setThreadId] = useState<string>('');
  const [currentCv, setCurrentCv] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const addProgress = (msg: string) => setProgress(p => [...p, { node: 'System', message: msg }]);

  const runImprover = async (baseCv: string, githubUsername: string) => {
    if (!baseCv || !githubUsername) {
      setError("Please provide a base CV and GitHub username.");
      return;
    }
    
    setIsRunning(true);
    setError(null);
    setNeedsHumanInput(false);
    setProgress([]);
    setStreamingTokens({});
    setActiveNodes([]);
    
    const newThreadId = Math.random().toString(36).substring(7);
    setThreadId(newThreadId);
    
    try {
      addProgress("Fetching GitHub portfolio...");
      const res = await fetch(`https://api.github.com/users/${githubUsername}/repos?per_page=100&sort=updated`);
      if (!res.ok) throw new Error("Failed to fetch GitHub repositories. Check the username.");
      const repos = await res.json();
      addProgress(`Found ${repos.length} repositories.`);

      const initialState = {
        current_cv: baseCv,
        github_portfolio: repos,
        iterations: 0,
        user_answers: {}
      };
      
      addProgress("Starting 10/10 Improvement Loop...");

      await executeGraph(initialState, newThreadId);
      
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      addProgress("Workflow failed.");
      setIsRunning(false);
    }
  };

  const submitAnswers = async (answers: Record<string, string>) => {
    setIsRunning(true);
    setNeedsHumanInput(false);
    setError(null);
    setStreamingTokens(prev => { 
       // Clear streaming tokens for nodes that will re-run
       const next = { ...prev };
       delete next['Rewrite_CV'];
       delete next['Evaluate_CV'];
       return next;
    });

    try {
      addProgress("Resuming workflow with human input...");
      const config = { configurable: { thread_id: threadId } };
      await cvImproverGraph.updateState(config, { user_answers: answers });
      await executeGraph(null, threadId);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      addProgress("Workflow failed.");
      setIsRunning(false);
    }
  };

  const executeGraph = async (initialState: any, tid: string) => {
    const config = { 
      configurable: { 
        thread_id: tid,
        onChunk: (nodeName: string, text: string) => {
          setStreamingTokens(prev => ({
            ...prev,
            [nodeName]: (prev[nodeName] || '') + text
          }));
        }
      } 
    };

    const stream = await cvImproverGraph.stream(initialState, config);
    
    for await (const event of stream) {
      const nodeNames = Object.keys(event);
      setActiveNodes(nodeNames);
      
      for (const nodeName of nodeNames) {
        const state = await cvImproverGraph.getState(config);
        
        if (nodeName === "Match_GitHub_Projects") addProgress(`Matched GitHub Projects: ${state.values.selected_projects?.join(", ")}`);
        else if (nodeName === "Fetch_Repo_Context") addProgress("Fetched deep context from selected repositories.");
        else if (nodeName === "Evaluate_CV") addProgress(`Evaluated CV. Score: ${state.values.score}/10`);
        else if (nodeName === "Rewrite_CV") addProgress("Rewrote CV based on critique and GitHub context.");

        if (state.values.score) setScore(state.values.score);
        if (state.values.critique) setCritique(state.values.critique);
        if (state.values.current_cv) setCurrentCv(state.values.current_cv);
      }
    }
    
    const finalState = await cvImproverGraph.getState(config);
    if (finalState.next.includes("Ask_User")) {
      setQuestions(finalState.values.questions_for_user || []);
      setNeedsHumanInput(true);
      setActiveNodes(["Ask_User"]);
      addProgress("Paused: Waiting for human input to clarify STAR details.");
    } else {
      setActiveNodes(["END"]);
      addProgress("Workflow Complete! Achieved SOTA standard.");
    }
    setIsRunning(false);
  };

  return {
    runImprover,
    submitAnswers,
    isRunning,
    progress,
    activeNodes,
    streamingTokens,
    score,
    critique,
    needsHumanInput,
    questions,
    currentCv,
    error,
    setError
  };
}
