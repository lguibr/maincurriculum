import { AppState } from "./types";

export function handleLanggraphEvent(payload: any, state: AppState) {
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
    } catch (e) {}
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
        const pathStr = String(input.file_path || input.path);
        const match = pathStr.match(/\/temp_repos\/([^\/]+)/);
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
        try { outputStr = JSON.stringify(payload.data?.output || {}, null, 2); } catch (e) {}
      }
      if (outputStr && outputStr.length > 0 && outputStr !== "{}") {
        newSubagents[runId].content += "\n\n### Done.";
      }
    }
  }

  if (payload.event === "on_chain_start") {
    const nodeName = payload.name;
    const runId = payload.run_id || nodeName;
    if (nodeName && !["LangGraph", "__start__", "RunnableLambda", "Supervisor", "deep_agent"].includes(nodeName)) {
      newSubagents[runId] = { id: runId, name: nodeName, status: "running", content: `Agent node started: ${nodeName}` };
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
          if (outStr !== "{}") newSubagents[runId].content += "\n\n### Done.";
        } catch (e) {}
      }
    }
  }

  if (payload.event === "on_chat_model_start") {
    let nodeName = payload.metadata?.langgraph_node || payload.name;
    if (nodeName === "model_request") nodeName = "DeepAgent Reasoner";
    const runId = payload.run_id || nodeName;
    if (nodeName && nodeName !== "Supervisor") {
      newSubagents[runId] = { id: runId, name: nodeName, status: "running", content: newSubagents[runId]?.content || "" };
    }
  }

  if (payload.event === "on_chat_model_stream") {
    let nodeName = payload.metadata?.langgraph_node || payload.name;
    if (nodeName === "model_request") nodeName = "DeepAgent Reasoner";
    const runId = payload.run_id || nodeName;
    if (nodeName && nodeName !== "Supervisor") {
      if (!newSubagents[runId]) newSubagents[runId] = { id: runId, name: nodeName, status: "running", content: "" };
      else newSubagents[runId].status = "running";
      newSubagents[runId].content += payload.data?.chunk?.text || "";
    }
  }

  if (payload.event === "on_chat_model_end") {
    let nodeName = payload.metadata?.langgraph_node || payload.name;
    if (nodeName === "model_request") nodeName = "DeepAgent Reasoner";
    const runId = payload.run_id || nodeName;
    if (nodeName && newSubagents[runId]) newSubagents[runId].status = "complete";
  }

  return { langgraphEvents: [...state.langgraphEvents, payload], subagents: newSubagents, reposProgress: newReposProgress, targetRepos: newTargetRepos };
}

export function handleLogEvent(msg: string, state: AppState) {
  let pgr = state.progress;
  let phase = state.currentPhase;
  let newReposProgress = { ...state.reposProgress };
  let newKbTree = [...state.knowledgeBaseTree];

  const repoNameFall = msg.match(/(?:\/temp_repos\/([^\/]+))/);

  let foundName = null;
  const sortedRepos = [...state.targetRepos].sort((a, b) => b.length - a.length);
  for (const repoName of sortedRepos) {
    if (msg.includes(repoName)) {
      foundName = repoName;
      break;
    }
  }
  if (repoNameFall && repoNameFall[1]) foundName = repoNameFall[1];

  if (foundName && newReposProgress[foundName]) {
    let stepPgr = newReposProgress[foundName].currentPhaseProgress;
    let innerPhase = newReposProgress[foundName].phase;

    // Detect detailed complete phases
    if (msg.includes("already ingested") || msg.includes("(Cached)")) { stepPgr = 100; innerPhase = "Complete (Cached)"; newKbTree.push(`|- ${foundName} [✓ Cached]`); }
    else if (msg.includes("(Failed I/O)")) { stepPgr = 100; innerPhase = "Failed: I/O (Private/Not Found)"; newKbTree.push(`|- ${foundName} [x Clone Failed]`); }
    else if (msg.includes("(Failed Read)")) { stepPgr = 100; innerPhase = "Failed: Read Error"; newKbTree.push(`|- ${foundName} [x Read Failed]`); }
    else if (msg.includes("Repo ingestion complete")) { stepPgr = 100; innerPhase = "Complete"; newKbTree.push(`|- ${foundName} [✓ Completed]`); }
    
    // Normal ingest logic
    else if (msg.includes("Cloning")) { stepPgr = 10; innerPhase = "Cloning..."; }
    else if (msg.includes("Pulling")) { stepPgr = 10; innerPhase = "Pulling..."; newKbTree.push(`|- ${foundName} [Git Pull]`); }
    else if (msg.includes("flattening")) { stepPgr = 40; innerPhase = "Flattening Source"; newKbTree.push(`|- ${foundName}/source_tree.txt (flattened)`); }
    else if (msg.includes("embedding architecture")) { stepPgr = 60; innerPhase = "Embedding Code..."; }
    else if (msg.includes("Summarizing")) { stepPgr = 85; innerPhase = "LLM Summarization..."; newKbTree.push(`|- ${foundName}/embeddings.index`); newKbTree.push(`|- ${foundName}/chunked_summaries.json (generating)`); }
    
    const now = Date.now();
    const started = newReposProgress[foundName].timeStarted || now;
    const elapsedSec = (now - started) / 1000;
    
    // Dynamic ETA: (elapsed / percentage_done) * remaining_percentage
    let eta = 45;
    if (stepPgr === 100) {
      eta = 0;
    } else if (stepPgr > 0) {
      // Calculate realistic remaining time based on actual speed
      const totalEstimated = elapsedSec / (stepPgr / 100);
      eta = Math.max(15, totalEstimated - elapsedSec);
    } else {
      eta = 60;
    }

    newReposProgress[foundName] = { ...newReposProgress[foundName], progress: stepPgr, currentPhaseProgress: stepPgr, phase: innerPhase, etaSeconds: Math.round(eta), timeStarted: started };
  }

  if (msg.includes("Found") && msg.includes("target repositories")) { phase = "Preparing Repository Ingestion..."; pgr = 5; }
  else if (msg.includes("Fetching GitHub repos")) { phase = "Fetching Repositories..."; pgr = 2; }
  else if (msg.includes("Generating project vector embeddings")) { phase = "Initializing Variables..."; pgr = 0; }
  else if (msg.includes("Database RAG Vectors loaded")) { phase = "Context Ready"; pgr = 100; }
  else if (msg.includes("Extracting skills and experiences")) { phase = "Extracting Relational Entities..."; pgr = 95; } // Catches the long LLM processing post-repo mapping
  else if (msg.includes("Entities extraction failed")) { phase = "Extraction Finished (With Error)"; pgr = 100; }

  return { logs: [...state.logs, msg], progress: pgr, currentPhase: phase, reposProgress: newReposProgress, knowledgeBaseTree: newKbTree };
}
