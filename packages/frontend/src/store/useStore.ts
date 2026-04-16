import { create } from 'zustand';

interface SSEMessage {
  type: string;
  message?: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
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

  // Actions
  startAgent: () => Promise<void>;
  submitAnswer: (answer: string) => Promise<void>;
  setIsRunning: (val: boolean) => void;
  setIsWizardComplete: (val: boolean) => void;
}

let eventSource: EventSource | null = null;

export const useStore = create<AppState>((set, get) => ({
  githubUsername: '',
  setGithubUsername: (val) => set({ githubUsername: val }),
  baseCv: '<!-- \n  Paste your Markdown Curriculum here...\n  (Click anywhere in this box to edit!)\n-->\n\n',
  setBaseCv: (val) => set({ baseCv: val }),
  cvViewMode: 'raw',
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
      langgraphValues: {}
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
             set((state) => ({ langgraphEvents: [...state.langgraphEvents, parsed.payload as Record<string, unknown>] }));
          }
          return;
        }

        if (parsed.type === "log") {
          set((state) => {
            let pgr = state.progress;
            let phase = state.currentPhase;
            const msg = parsed.message || "";
            
            // Embedding chunk X/Y
            let chunkMatch = msg.match(/\[(.*?)\] Embedding chunk (\d+)\/(\d+)\.\.\./);
            if (chunkMatch) {
                pgr = (parseInt(chunkMatch[2]) / parseInt(chunkMatch[3])) * 100;
                phase = `Embedding: ${chunkMatch[1]}`;
            } else if (msg.includes("Using Gemini 3.1 Flash Lite")) {
                phase = "Summarizing via Gemini 3.1 Flash Lite...";
                pgr = 50;
            } else if (msg.includes("Fetching GitHub handle")) {
                phase = "Fetching Repositories...";
                pgr = 10;
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
               currentPhase: phase
            };
          });
        }

        if (parsed.type === "interrupt") {
          set((state) => ({
             currentPhase: String(parsed.data?.phase || "Interview Phase"),
             currentQuestion: parsed.data?.question as string | null,
             logs: [...state.logs, "Agent paused for user input..."]
          }));
        }

        if (parsed.type === "complete") {
          set({
             isRunning: false,
             isWizardComplete: true,
             currentPhase: "Onboarding Complete",
             langgraphValues: { wizardCompleted: true }
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
  }
}));
