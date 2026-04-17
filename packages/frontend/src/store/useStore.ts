import { create } from "zustand";

interface SSEMessage {
  type: string;
  message?: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}


export interface SubagentStreamInterface {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  content: string;
}

interface AppState {
  // Input State
  githubUsername: string;
  setGithubUsername: (val: string) => void;
  baseCv: string;
  setBaseCv: (val: string) => void;
  cvViewMode: "raw" | "preview";
  setCvViewMode: (mode: "raw" | "preview") => void;

  // Pipeline State
  isRunning: boolean;
  logs: string[];
  progress: number;
  activeNodes: string[];
  currentPhase: string;
  currentQuestion: string | null;
  isWizardComplete: boolean;
  langgraphEvents: Record<string, unknown>[];
  langgraphValues: Record<string, unknown>;
  subagents: Record<string, SubagentStreamInterface>;
  targetRepos: string[];
  reposProgress: Record<string, { phase: string; progress: number, currentPhaseProgress: number }>;

  // Actions
  startAgent: () => Promise<void>;
  submitAnswer: (answer: string) => Promise<void>;
  setIsRunning: (val: boolean) => void;
  setIsWizardComplete: (val: boolean) => void;
}

let eventSource: EventSource | null = null;

export const useStore = create<AppState>((set, get) => ({
  githubUsername: "",
  setGithubUsername: (val) => set({ githubUsername: val }),
  baseCv:
    "<!-- \n  Paste your Markdown Curriculum here...\n  (Click anywhere in this box to edit!)\n-->\n\n",
  setBaseCv: (val) => set({ baseCv: val }),
  cvViewMode: "raw",
  setCvViewMode: (mode) => set({ cvViewMode: mode }),

  isRunning: false,
  logs: [],
  progress: 0,
  activeNodes: [],
  currentPhase: "Parsing Github...",
  currentQuestion: null,
  isWizardComplete: false,
  langgraphEvents: [],
  langgraphValues: {},
  subagents: {},
  targetRepos: [],
  reposProgress: {},

  setIsRunning: (val) => set({ isRunning: val }),
  setIsWizardComplete: (val) => set({ isWizardComplete: val }),

  startAgent: async () => {
    const { githubUsername, baseCv } = get();

    set({
      isRunning: true,
      logs: [],
      currentQuestion: null,
      progress: 0,
      activeNodes: [],
      currentPhase: "Parsing Github...",
      isWizardComplete: false,
      langgraphEvents: [],
      langgraphValues: {},
      subagents: {},
      targetRepos: [],
      reposProgress: {},
    });

    try {
      await fetch(`http://${window.location.hostname}:3001/api/ingest/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: githubUsername, baseCv }),
      });

      if (eventSource) eventSource.close();
      eventSource = new EventSource(`http://${window.location.hostname}:3001/api/ingest/stream`);

      eventSource.onmessage = (event) => {
        const parsed = JSON.parse(event.data) as SSEMessage;
        if (parsed.type === "ping") return;

        if (parsed.type === "langgraph_event") {
          if (parsed.payload) {
            const payload = parsed.payload as any;
            
            set((state) => {
              const newSubagents = { ...state.subagents };
              let newTargetRepos = [...state.targetRepos];
              let newReposProgress = { ...state.reposProgress };

              if (payload.event === "on_tool_end" && payload.name === "fetch_github_repos") {
                try {
                  const reposArray = JSON.parse(payload.data?.output);
                  newTargetRepos = reposArray.map((r: any) => r.name);
                  for (const name of newTargetRepos) {
                    newReposProgress[name] = { phase: "Pending Initialization...", progress: 0, currentPhaseProgress: 0 };
                  }
                } catch(e) {}
              }

              if (payload.event === "on_tool_start") {
                const nodeName = payload.name;
                const runId = payload.run_id || nodeName;
                if (nodeName) {
                  let argsStr = "";
                  try {
                    argsStr = JSON.stringify(payload.data?.input || {}, null, 2);
                  } catch (e) {}

                  newSubagents[runId] = {
                    id: runId,
                    name: nodeName,
                    status: "running",
                    content: `Executing ${nodeName}...\n\n### Input Payload:\n\`\`\`json\n${argsStr}\n\`\`\``,
                  };
                  
                  // Extract Repo Progress
                  const input = payload.data?.input;
                  if (input && (nodeName === "process_repo" || nodeName === "clone_repo" || nodeName === "embed_project")) {
                    const rName = input.repoName;
                    if (rName && newReposProgress[rName]) {
                       newReposProgress[rName].phase = "Initializing...";
                       newReposProgress[rName].currentPhaseProgress = 0;
                       newReposProgress[rName].progress = 5;
                    }
                  } else if (input?.file_path || input?.path) {
                    // Try to guess from file path if it's operating on a repo
                    const pathStr = String(input.file_path || input.path);
                    const match = pathStr.match(/\/temp_repos\/([^/]+)/);
                    if (match && match[1] && newReposProgress[match[1]]) {
                       newReposProgress[match[1]].phase = "Reading Files...";
                    }
                  }
                }
              }

              if (payload.event === "on_tool_end") {
                const nodeName = payload.name;
                const runId = payload.run_id || nodeName;
                if (nodeName && newSubagents[runId]) {
                  newSubagents[runId].status = "complete";
                  
                  let outputStr = "";
                  if (typeof payload.data?.output === "string") {
                    outputStr = payload.data.output;
                  } else {
                    try {
                      outputStr = JSON.stringify(payload.data?.output || {}, null, 2);
                    } catch (e) {}
                  }

                  if (outputStr && outputStr.length > 0) {
                    newSubagents[runId].content += `\n\n### Output Result:\n\`\`\`json\n${outputStr}\n\`\`\``;
                  }
                }
              }

              if (payload.event === "on_chat_model_start") {
                let nodeName = payload.metadata?.langgraph_node || payload.name;
                if (nodeName === "model_request") nodeName = "DeepAgent Reasoner";
                const runId = payload.run_id || nodeName;
                
                if (nodeName && nodeName !== "Supervisor") {
                  newSubagents[runId] = {
                    id: runId,
                    name: nodeName,
                    status: "running",
                    content: newSubagents[runId]?.content || "",
                  };
                }
              }

              if (payload.event === "on_chat_model_stream") {
                let nodeName = payload.metadata?.langgraph_node || payload.name;
                if (nodeName === "model_request") nodeName = "DeepAgent Reasoner";
                const runId = payload.run_id || nodeName;
                
                if (nodeName && nodeName !== "Supervisor") {
                  if (!newSubagents[runId]) {
                    newSubagents[runId] = {
                      id: runId,
                      name: nodeName,
                      status: "running",
                      content: "",
                    };
                  } else {
                    newSubagents[runId].status = "running";
                  }
                  newSubagents[runId].content += payload.data?.chunk?.text || "";
                }
              }

              if (payload.event === "on_chat_model_end") {
                let nodeName = payload.metadata?.langgraph_node || payload.name;
                if (nodeName === "model_request") nodeName = "DeepAgent Reasoner";
                const runId = payload.run_id || nodeName;

                if (nodeName && newSubagents[runId]) {
                  newSubagents[runId].status = "complete";
                }
              }

              return {
                langgraphEvents: [...state.langgraphEvents, payload],
                subagents: newSubagents,
                reposProgress: newReposProgress,
                targetRepos: newTargetRepos,
              };
            });
          }
          return;
        }

        if (parsed.type === "log") {
          set((state) => {
            let pgr = state.progress;
            let phase = state.currentPhase;
            let newReposProgress = { ...state.reposProgress };
            const msg = parsed.message || "";

            // Repo Processing
            const repoMatch = msg.match(/\[Repo\s+(\d+)\/(\d+)\]\s+(?:Cloning|Pulling latest for|Summarizing flat source|Repo ingestion complete).*?\b([\w-]+\/[\w-]+|\w+)\b/i);
            const repoNameFall = msg.match(/(?:\/temp_repos\/([^/]+))/);
            
            // Or look for specific messages that explicitly contain the name
            let foundName = null;
            for (const repoName of state.targetRepos) {
              if (msg.includes(repoName)) foundName = repoName;
            }
            if (repoNameFall && repoNameFall[1]) foundName = repoNameFall[1];

            if (foundName && newReposProgress[foundName]) {
               let stepPgr = newReposProgress[foundName].currentPhaseProgress;
               let innerPhase = newReposProgress[foundName].phase;

               if (msg.includes("already ingested")) {
                 stepPgr = 100;
                 innerPhase = "Complete (Cached)";
               } else if (msg.includes("Cloning")) {
                 stepPgr = 10;
                 innerPhase = "Cloning...";
               } else if (msg.includes("Pulling")) {
                 stepPgr = 10;
                 innerPhase = "Pulling...";
               } else if (msg.includes("flattening")) {
                 stepPgr = 40;
                 innerPhase = "Flattening Source";
               } else if (msg.includes("embedding architecture")) {
                 stepPgr = 60;
                 innerPhase = "Embedding Code...";
               } else if (msg.includes("Summarizing")) {
                 stepPgr = 85;
                 innerPhase = "LLM Summarization...";
               } else if (msg.includes("Repo ingestion complete")) {
                 stepPgr = 100;
                 innerPhase = "Complete";
               }

               newReposProgress[foundName] = {
                 ...newReposProgress[foundName],
                 progress: stepPgr, // overall progress of this repo
                 currentPhaseProgress: stepPgr,
                 phase: innerPhase
               };
            }

            if (msg.includes("Found") && msg.includes("target repositories")) {
              phase = "Preparing Repository Ingestion...";
              pgr = 5;
            } else if (msg.includes("Fetching GitHub repos")) {
              phase = "Fetching Repositories...";
              pgr = 2;
            } else if (msg.includes("Generating project vector embeddings")) {
              phase = "Initializing Variables...";
              pgr = 0;
            } else if (msg.includes("Database RAG Vectors loaded")) {
              phase = "Context Ready";
              pgr = 100;
            }

            return {
              logs: [...state.logs, msg],
              progress: pgr,
              currentPhase: phase,
              reposProgress: newReposProgress,
            };
          });
        }

        if (parsed.type === "interrupt") {
          set((state) => ({
            currentPhase: String(parsed.data?.phase || "Interview Phase"),
            currentQuestion: parsed.data?.question as string | null,
            logs: [...state.logs, "Agent paused for user input..."],
          }));
        }

        if (parsed.type === "complete") {
          set((state) => {
            const finalSubapps = { ...state.subagents };
            // Mark all stragglers as complete
            for (const key of Object.keys(finalSubapps)) {
              finalSubapps[key].status = "complete";
            }
            return {
              isRunning: false,
              isWizardComplete: true,
              currentPhase: "Onboarding Complete",
              langgraphValues: { wizardCompleted: true },
              subagents: finalSubapps,
            };
          });
          eventSource?.close();
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE Error:", err);
        eventSource?.close();
        set({ isRunning: false });
      };
    } catch (e: unknown) {
      console.error("Failed to start agent:", e);
      set({ isRunning: false });
    }
  },

  submitAnswer: async (answer: string) => {
    set({ currentQuestion: null });
    await fetch(`http://${window.location.hostname}:3001/api/ingest/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
  },
}));
