import re

with open("packages/frontend/src/store/useStore.ts", "r") as f:
    text = f.read()

# We need to extract the giant set calls.
# Let's just generate the new file.

new_file = text[:text.find("let eventSource: EventSource | null = null;")]

new_file += """

function handleLanggraphEvent(payload: any, state: AppState) {
  const newSubagents = { ...state.subagents };
  let newTargetRepos = [...state.targetRepos];
  let newReposProgress = { ...state.reposProgress };

  if (payload.event === "on_tool_end" && payload.name === "fetch_github_repos") {
    try {
      const reposArray = JSON.parse(payload.data?.output);
      newTargetRepos = reposArray.map((r: any) => r.name);
      for (const name of newTargetRepos) {
        newReposProgress[name] = { phase: "Pending Initialization...", progress: 0, currentPhaseProgress: 0, timeStarted: Date.now(), etaSeconds: 45 };
      }
    } catch (e) { }
  }

  if (payload.event === "on_tool_start") {
    const nodeName = payload.name;
    const runId = payload.run_id || nodeName;
    if (nodeName) {
      let argsStr = "";
      try {
        argsStr = JSON.stringify(payload.data?.input || {}, null, 2);
      } catch (e) { }

      newSubagents[runId] = {
        id: runId,
        name: nodeName,
        status: "running",
        content: `Executing ${nodeName}...\\n\\n### Input Payload:\\n\`\`\`json\\n${argsStr}\\n\`\`\``,
      };

      // Extract Repo Progress
      const input = payload.data?.input;
      if (input && (nodeName === "process_repo" || nodeName === "clone_repo" || nodeName === "embed_project")) {
        const rName = input.repoName;
        if (rName && newReposProgress[rName]) {
          newReposProgress[rName].phase = "Initializing...";
          newReposProgress[rName].currentPhaseProgress = 0;
          newReposProgress[rName].progress = 5;
          newReposProgress[rName].timeStarted = newReposProgress[rName].timeStarted || Date.now();
        }
      } else if (input?.file_path || input?.path) {
        // Try to guess from file path if it's operating on a repo
        const pathStr = String(input.file_path || input.path);
        const match = pathStr.match(/\\/temp_repos\\/([^\\/]+)/);
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
        } catch (e) { }
      }

      if (outputStr && outputStr.length > 0 && outputStr !== "{}") {
        newSubagents[runId].content += `\\n\\n### Done.`;
      }
    }
  }

  if (payload.event === "on_chain_start") {
    const nodeName = payload.name;
    const runId = payload.run_id || nodeName;
    if (nodeName && !["LangGraph", "__start__", "RunnableLambda", "Supervisor", "deep_agent"].includes(nodeName)) {
      newSubagents[runId] = {
        id: runId,
        name: nodeName,
        status: "running",
        content: `Agent node started: ${nodeName}`
      }
    }
  }

  if (payload.event === "on_chain_end") {
    const nodeName = payload.name;
    const runId = payload.run_id || nodeName;
    if (nodeName && newSubagents[runId]) {
      newSubagents[runId].status = "complete";
      if (payload.data?.output) {
        try {
          const outStr = typeof payload.data.output === "string" ? payload.data.output : JSON.stringify(payload.data.output, null, 2);
          if (outStr !== "{}") {
            newSubagents[runId].content += `\\n\\n### Done.`;
          }
        } catch (e) { }
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
}

function handleLogEvent(msg: string, state: AppState) {
  let pgr = state.progress;
  let phase = state.currentPhase;
  let newReposProgress = { ...state.reposProgress };

  // Repo Processing
  const repoMatch = msg.match(/\\[Repo\\s+(\\d+)\\/(\\d+)\\]\\s+(?:Cloning|Pulling latest for|Summarizing flat source|Repo ingestion complete).*?\\b([\\w-]+\\/[\\w-]+|\\w+)\\b/i);
  const repoNameFall = msg.match(/(?:\\/temp_repos\\/([^\\/]+))/);

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

    // Dynamic ETA Calculation
    const now = Date.now();
    const started = newReposProgress[foundName].timeStarted || now;
    const elapsedSec = (now - started) / 1000;
    let eta = 45; // default 45 seconds

    if (stepPgr > 5 && stepPgr < 100) {
      const velocity = stepPgr / elapsedSec; // % per second
      eta = Math.max(1, Math.round((100 - stepPgr) / velocity));
    } else if (stepPgr === 100) {
      eta = 0;
    }

    newReposProgress[foundName] = {
      ...newReposProgress[foundName],
      progress: stepPgr, // overall progress of this repo
      currentPhaseProgress: stepPgr,
      phase: innerPhase,
      etaSeconds: eta,
      timeStarted: started
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
}

let eventSource: EventSource | null = null;
"""

idx_store = text.find("export const useStore = create<AppState>((set, get) => ({")
end_idx = text.find("eventSource.onerror = (err) => {", idx_store)

rest_of_file = text[end_idx:]

new_store = text[idx_store:text.find("setupSseHandler: () => {", idx_store)]

new_store += """setupSseHandler: () => {
    if (!eventSource) return;
    eventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as SSEMessage;
      if (parsed.type === "ping") return;

      if (parsed.type === "langgraph_event" && parsed.payload) {
        set((state) => handleLanggraphEvent(parsed.payload, state) as any);
        return;
      }

      if (parsed.type === "log" && parsed.message) {
        set((state) => handleLogEvent(parsed.message!, state) as any);
        return;
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

    """

with open("packages/frontend/src/store/useStore.ts", "w") as f:
    f.write(new_file + new_store + rest_of_file)
