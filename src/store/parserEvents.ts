import { AppState } from "./types";

export function handleLanggraphEvent(payload: any, state: AppState) {
  const newSubagents = { ...state.subagents };
  let newTargetRepos = [...state.targetRepos];
  const newReposProgress = { ...state.reposProgress };

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
      try { argsStr = JSON.stringify(payload.data?.input || {}, null, 2); } catch (e) {}
      newSubagents[runId] = { id: runId, name: nodeName, status: "running", content: `Executing ${nodeName}...\n\n### Input Payload:\n```json\n${argsStr}\n```` };

      const input = payload.data?.input;
      if (input && (nodeName === "process_repo" || nodeName === "clone_repo" || nodeName === "embed_project")) {
        const rName = input.repoName;
        if (rName && newReposProgress[rName]) {
          newReposProgress[rName].phase = "Initializing..."; newReposProgress[rName].currentPhaseProgress = 0; newReposProgress[rName].progress = 5; newReposProgress[rName].timeStarted = newReposProgress[rName].timeStarted || Date.now();
        }
      } else if (input?.file_path || input?.path) {
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
      if (typeof payload.data?.output === "string") outputStr = payload.data.output;
      else { try { outputStr = JSON.stringify(payload.data?.output || {}, null, 2); } catch (e) {} }
      if (outputStr && outputStr.length > 0 && outputStr !== "{}") newSubagents[runId].content += "\n\n### Done.";
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
    if (nodeName && nodeName !== "Supervisor") newSubagents[runId] = { id: runId, name: nodeName, status: "running", content: newSubagents[runId]?.content || "" };
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
