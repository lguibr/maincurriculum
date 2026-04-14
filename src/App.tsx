import React, { useState, useRef, useEffect } from 'react';
import { appGraph } from './agent/graph';
import { cvImproverGraph } from './agent/cvImproverGraph';
import Markdown from 'react-markdown';
import { Loader2, Github, FileText, Briefcase, CheckCircle, AlertCircle, RefreshCw, Send, User, Star, Activity } from 'lucide-react';

const NodeVisualizer = ({ nodes, activeNode }: { nodes: string[], activeNode: string }) => {
  return (
    <div className="flex items-center space-x-2 overflow-x-auto py-3 px-4 bg-neutral-900/50 rounded-xl border border-neutral-800/50 mb-6">
      <Activity className="w-4 h-4 text-neutral-500 mr-2 shrink-0" />
      {nodes.map((node, i) => (
        <React.Fragment key={node}>
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors duration-300 ${activeNode === node ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-neutral-900 border-neutral-800 text-neutral-500'}`}>
            {node.replace(/_/g, ' ')}
          </div>
          {i < nodes.length - 1 && <div className="h-px w-4 bg-neutral-800 shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'improver' | 'tailor'>('improver');

  // --- Shared State ---
  const [githubUsername, setGithubUsername] = useState('');
  const [baseCv, setBaseCv] = useState('');

  // --- Tailor State ---
  const [jobDescription, setJobDescription] = useState('');
  const [isTailorRunning, setIsTailorRunning] = useState(false);
  const [tailorProgress, setTailorProgress] = useState<string[]>([]);
  const [tailorResult, setTailorResult] = useState<{ cv: string; coverLetter: string } | null>(null);
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [activeTailorNode, setActiveTailorNode] = useState<string>('');

  // --- Improver State ---
  const [isImproverRunning, setIsImproverRunning] = useState(false);
  const [improverProgress, setImproverProgress] = useState<string[]>([]);
  const [improverScore, setImproverScore] = useState<number>(0);
  const [improverCritique, setImproverCritique] = useState<string>('');
  const [needsHumanInput, setNeedsHumanInput] = useState(false);
  const [improverQuestions, setImproverQuestions] = useState<string[]>([]);
  const [improverAnswers, setImproverAnswers] = useState<Record<string, string>>({});
  const [improverThreadId, setImproverThreadId] = useState<string>('');
  const [activeImproverNode, setActiveImproverNode] = useState<string>('');
  const [improverError, setImproverError] = useState<string | null>(null);

  const bottomRefTailor = useRef<HTMLDivElement>(null);
  const bottomRefImprover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRefTailor.current) bottomRefTailor.current.scrollIntoView({ behavior: 'smooth' });
  }, [tailorProgress]);

  useEffect(() => {
    if (bottomRefImprover.current) bottomRefImprover.current.scrollIntoView({ behavior: 'smooth' });
  }, [improverProgress]);

  const handleRunTailor = async () => {
    if (!jobDescription || !baseCv || !githubUsername) {
      setTailorError("Please fill in all fields.");
      return;
    }
    
    setIsTailorRunning(true);
    setTailorError(null);
    setTailorProgress([]);
    setTailorResult(null);

    try {
      setTailorProgress(p => [...p, "Fetching GitHub portfolio..."]);
      const res = await fetch(`https://api.github.com/users/${githubUsername}/repos?per_page=100&sort=updated`);
      if (!res.ok) throw new Error("Failed to fetch GitHub repositories. Check the username.");
      const repos = await res.json();
      setTailorProgress(p => [...p, `Found ${repos.length} repositories.`]);

      const initialState = {
        job_description: jobDescription,
        base_cv: baseCv,
        github_portfolio: repos,
        jd_analysis: {},
        selected_projects: [],
        repo_deep_dives: {},
        draft_cv: "",
        draft_cover_letter: "",
        critique_feedback: "",
        next_action: "",
        iterations: 0
      };

      setTailorProgress(p => [...p, "Starting Agentic Workflow..."]);
      
      const stream = await appGraph.stream(initialState);
      let finalState: any = null;

      for await (const event of stream) {
        const nodeName = Object.keys(event)[0];
        setActiveTailorNode(nodeName);
        finalState = event[nodeName];
        
        if (nodeName === "Analyze_JD") setTailorProgress(p => [...p, "Analyzed Job Description. Extracted core skills."]);
        else if (nodeName === "Profile_Match") setTailorProgress(p => [...p, `Matched Profile. Selected projects: ${finalState.selected_projects?.join(", ")}`]);
        else if (nodeName === "Fetch_Repo_Context") setTailorProgress(p => [...p, "Fetched deep context from selected repositories."]);
        else if (nodeName === "Draft_Docs") setTailorProgress(p => [...p, `Drafted CV and Cover Letter (Iteration ${finalState.iterations}).`]);
        else if (nodeName === "Critique_Agent") {
          setTailorProgress(p => [...p, `Critique Agent evaluated drafts. Action: ${finalState.next_action}`]);
          if (finalState.critique_feedback) setTailorProgress(p => [...p, `Feedback: ${finalState.critique_feedback}`]);
        }
      }

      if (finalState) {
        setTailorResult({ cv: finalState.draft_cv, coverLetter: finalState.draft_cover_letter });
        setTailorProgress(p => [...p, "Workflow Complete!"]);
        setActiveTailorNode("END");
      }
    } catch (err: any) {
      setTailorError(err.message || "An error occurred during execution.");
      setTailorProgress(p => [...p, "Workflow failed."]);
    } finally {
      setIsTailorRunning(false);
    }
  };

  const handleRunImprover = async () => {
    if (!baseCv || !githubUsername) {
      setImproverError("Please provide a base CV and GitHub username.");
      return;
    }
    setIsImproverRunning(true);
    setImproverError(null);
    setNeedsHumanInput(false);
    setImproverProgress([]);
    
    const threadId = Math.random().toString(36).substring(7);
    setImproverThreadId(threadId);
    const config = { configurable: { thread_id: threadId } };
    
    try {
      setImproverProgress(p => [...p, "Fetching GitHub portfolio..."]);
      const res = await fetch(`https://api.github.com/users/${githubUsername}/repos?per_page=100&sort=updated`);
      if (!res.ok) throw new Error("Failed to fetch GitHub repositories. Check the username.");
      const repos = await res.json();
      setImproverProgress(p => [...p, `Found ${repos.length} repositories.`]);

      const initialState = {
        current_cv: baseCv,
        github_portfolio: repos,
        iterations: 0,
        user_answers: {}
      };
      
      setImproverProgress(p => [...p, "Starting 10/10 Improvement Loop..."]);

      const stream = await cvImproverGraph.stream(initialState, config);
      for await (const event of stream) {
        const nodeName = Object.keys(event)[0];
        setActiveImproverNode(nodeName);
        const state = await cvImproverGraph.getState(config);
        
        if (nodeName === "Match_GitHub_Projects") setImproverProgress(p => [...p, `Matched GitHub Projects: ${state.values.selected_projects?.join(", ")}`]);
        else if (nodeName === "Fetch_Repo_Context") setImproverProgress(p => [...p, "Fetched deep context from selected repositories."]);
        else if (nodeName === "Evaluate_CV") setImproverProgress(p => [...p, `Evaluated CV. Score: ${state.values.score}/10`]);
        else if (nodeName === "Rewrite_CV") setImproverProgress(p => [...p, "Rewrote CV based on critique and GitHub context."]);

        if (state.values.score) setImproverScore(state.values.score);
        if (state.values.critique) setImproverCritique(state.values.critique);
        if (state.values.current_cv) setBaseCv(state.values.current_cv);
      }
      
      const finalState = await cvImproverGraph.getState(config);
      if (finalState.next.includes("Ask_User")) {
        setImproverQuestions(finalState.values.questions_for_user || []);
        setNeedsHumanInput(true);
        setActiveImproverNode("Ask_User");
        setImproverProgress(p => [...p, "Paused: Waiting for human input to clarify STAR details."]);
      } else {
        setActiveImproverNode("END");
        setImproverProgress(p => [...p, "Workflow Complete! Achieved SOTA standard."]);
      }
    } catch (err: any) {
      setImproverError(err.message || "An error occurred.");
      setImproverProgress(p => [...p, "Workflow failed."]);
    } finally {
      setIsImproverRunning(false);
    }
  };

  const handleAnswerSubmit = async () => {
    setIsImproverRunning(true);
    setNeedsHumanInput(false);
    setImproverError(null);
    const config = { configurable: { thread_id: improverThreadId } };
    
    try {
      setImproverProgress(p => [...p, "Resuming workflow with human input..."]);
      await cvImproverGraph.updateState(config, { user_answers: improverAnswers });
      const stream = await cvImproverGraph.stream(null, config);
      for await (const event of stream) {
        const nodeName = Object.keys(event)[0];
        setActiveImproverNode(nodeName);
        const state = await cvImproverGraph.getState(config);
        
        if (nodeName === "Evaluate_CV") setImproverProgress(p => [...p, `Evaluated CV. Score: ${state.values.score}/10`]);
        else if (nodeName === "Rewrite_CV") setImproverProgress(p => [...p, "Rewrote CV based on critique and user answers."]);

        if (state.values.score) setImproverScore(state.values.score);
        if (state.values.critique) setImproverCritique(state.values.critique);
        if (state.values.current_cv) setBaseCv(state.values.current_cv);
      }
      
      const finalState = await cvImproverGraph.getState(config);
      if (finalState.next.includes("Ask_User")) {
        setImproverQuestions(finalState.values.questions_for_user || []);
        setNeedsHumanInput(true);
        setActiveImproverNode("Ask_User");
        setImproverProgress(p => [...p, "Paused: Waiting for more human input."]);
      } else {
        setActiveImproverNode("END");
        setImproverProgress(p => [...p, "Workflow Complete! Achieved SOTA standard."]);
      }
    } catch (err: any) {
      setImproverError(err.message || "An error occurred.");
      setImproverProgress(p => [...p, "Workflow failed."]);
    } finally {
      setIsImproverRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-emerald-500/30">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">MainCurriculum</h1>
          </div>
          <div className="text-sm text-neutral-400 font-mono">LangGraph + Gemini 1.5 Pro</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="flex space-x-4 mb-8 border-b border-neutral-800 pb-4">
          <button 
            onClick={() => setActiveTab('improver')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'improver' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:bg-neutral-800'}`}
          >
            10/10 CV Improver (HITL)
          </button>
          <button 
            onClick={() => setActiveTab('tailor')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'tailor' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:bg-neutral-800'}`}
          >
            Job Tailor Agent
          </button>
        </div>

        {/* Improver Tab */}
        {activeTab === 'improver' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <NodeVisualizer nodes={['Match_GitHub_Projects', 'Fetch_Repo_Context', 'Evaluate_CV', 'Ask_User', 'Rewrite_CV', 'END']} activeNode={activeImproverNode} />
              
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-medium text-white mb-4 flex items-center">
                  <Github className="w-5 h-5 mr-2 text-neutral-400" />
                  GitHub Portfolio
                </h2>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-neutral-500 sm:text-sm">github.com/</span>
                  </div>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="username"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2 pl-24 pr-3 text-sm text-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  The agent will fetch your public repositories to ground your CV in reality.
                </p>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-medium text-white mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-purple-400" />
                  Current CV (Markdown)
                </h2>
                <textarea
                  value={baseCv}
                  onChange={(e) => setBaseCv(e.target.value)}
                  placeholder="Paste your CV here..."
                  className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-300 focus:ring-2 focus:ring-emerald-500 outline-none resize-none font-mono"
                />
              </div>

              {!needsHumanInput && (
                <button
                  onClick={handleRunImprover}
                  disabled={isImproverRunning}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {isImproverRunning ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing & Improving...</> : <><Star className="w-5 h-5 mr-2" /> Start 10/10 Improvement Loop</>}
                </button>
              )}

              {needsHumanInput && (
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                  <h2 className="text-lg font-medium text-emerald-400 mb-4 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Human-in-the-Loop Required
                  </h2>
                  <p className="text-sm text-neutral-300 mb-4">The agent needs more STAR details to improve your CV without hallucinating.</p>
                  
                  <div className="space-y-4">
                    {improverQuestions.map((q, idx) => (
                      <div key={idx}>
                        <label className="block text-sm font-medium text-neutral-200 mb-2">{q}</label>
                        <textarea
                          value={improverAnswers[q] || ''}
                          onChange={(e) => setImproverAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                          className="w-full h-24 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-300 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                          placeholder="Provide specific Situation, Task, Action, Result..."
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleAnswerSubmit}
                    disabled={isImproverRunning}
                    className="mt-4 w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {isImproverRunning ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</> : <><Send className="w-5 h-5 mr-2" /> Submit Answers & Resume</>}
                  </button>
                </div>
              )}

              {improverError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                  <p>{improverError}</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 flex flex-col space-y-6">
              
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-48">
                <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Improver Execution Log</span>
                  {isImproverRunning && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                </div>
                <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-2">
                  {improverProgress.length === 0 && !isImproverRunning && (
                    <div className="text-neutral-600 italic">Waiting to start...</div>
                  )}
                  {improverProgress.map((msg, i) => (
                    <div key={i} className="flex items-start">
                      <span className="text-emerald-500 mr-2">➜</span>
                      <span className="text-neutral-300">{msg}</span>
                    </div>
                  ))}
                  <div ref={bottomRefImprover} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center">
                  <div className="text-sm text-neutral-400 mb-1">SOTA Score</div>
                  <div className={`text-4xl font-bold ${improverScore >= 9.5 ? 'text-emerald-400' : improverScore >= 7 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {improverScore > 0 ? `${improverScore}/10` : '-'}
                  </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 overflow-y-auto max-h-32 text-sm text-neutral-300">
                  <div className="text-xs text-neutral-500 mb-2 uppercase tracking-wider font-mono">Latest Critique</div>
                  {improverCritique || "Waiting for evaluation..."}
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm flex-1 overflow-y-auto max-h-[800px]">
                <h2 className="text-xl font-semibold text-white mb-4 border-b border-neutral-800 pb-2 flex items-center justify-between">
                  <span className="flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-emerald-400" />
                    Live CV Preview
                  </span>
                  {isImproverRunning && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
                </h2>
                <div className="prose prose-invert prose-emerald max-w-none prose-sm">
                  <Markdown>{baseCv || "*Your improved CV will appear here...*"}</Markdown>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tailor Tab */}
        {activeTab === 'tailor' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <NodeVisualizer nodes={['Analyze_JD', 'Profile_Match', 'Fetch_Repo_Context', 'Draft_Docs', 'Critique_Agent', 'END']} activeNode={activeTailorNode} />
              
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-medium text-white mb-4 flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-blue-400" />
                  Job Description
                </h2>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the target job description here..."
                  className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none transition-all"
                />
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-medium text-white mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-purple-400" />
                  Base CV (Markdown)
                </h2>
                <textarea
                  value={baseCv}
                  onChange={(e) => setBaseCv(e.target.value)}
                  placeholder="Paste your raw markdown CV here..."
                  className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none transition-all font-mono"
                />
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-medium text-white mb-4 flex items-center">
                  <Github className="w-5 h-5 mr-2 text-neutral-400" />
                  GitHub Portfolio
                </h2>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-neutral-500 sm:text-sm">github.com/</span>
                  </div>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="username"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2 pl-24 pr-3 text-sm text-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  The agent will fetch your public repositories to use as deep context.
                </p>
              </div>

              <button
                onClick={handleRunTailor}
                disabled={isTailorRunning}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTailorRunning ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Agent Running...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Generate Tailored Application
                  </>
                )}
              </button>

              {tailorError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                  <p>{tailorError}</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 flex flex-col space-y-6">
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-64">
                <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Agent Execution Log</span>
                  {isTailorRunning && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                </div>
                <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-2">
                  {tailorProgress.length === 0 && !isTailorRunning && (
                    <div className="text-neutral-600 italic">Waiting to start...</div>
                  )}
                  {tailorProgress.map((msg, i) => (
                    <div key={i} className="flex items-start">
                      <span className="text-emerald-500 mr-2">➜</span>
                      <span className="text-neutral-300">{msg}</span>
                    </div>
                  ))}
                  <div ref={bottomRefTailor} />
                </div>
              </div>

              {tailorResult && (
                <div className="space-y-6">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-white mb-4 border-b border-neutral-800 pb-2 flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 text-emerald-400" />
                      Tailored Cover Letter
                    </h2>
                    <div className="prose prose-invert prose-emerald max-w-none prose-sm">
                      <Markdown>{tailorResult.coverLetter}</Markdown>
                    </div>
                  </div>

                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-white mb-4 border-b border-neutral-800 pb-2 flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 text-emerald-400" />
                      Tailored CV
                    </h2>
                    <div className="prose prose-invert prose-emerald max-w-none prose-sm">
                      <Markdown>{tailorResult.cv}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
