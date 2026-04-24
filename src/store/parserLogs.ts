import { AppState } from "./types";

export function handleLogEvent(msg: string, state: AppState) {
  let pgr = state.progress;
  let phase = state.currentPhase;
  const newReposProgress = { ...state.reposProgress };
  const newKbTree = [...state.knowledgeBaseTree];

  const repoNameFall = msg.match(/(?:\/temp_repos\/([^/]+))/);

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

    if (msg.includes("already ingested") || msg.includes("(Cached)")) {
      stepPgr = 100;
      innerPhase = "Complete (Cached)";
      newKbTree.push(`|- ${foundName} [✓ Cached]`);
    } else if (msg.includes("(Failed I/O)")) {
      stepPgr = 100;
      innerPhase = "Failed: I/O (Private/Not Found)";
      newKbTree.push(`|- ${foundName} [x Clone Failed]`);
    } else if (msg.includes("(Failed Read)")) {
      stepPgr = 100;
      innerPhase = "Failed: Read Error";
      newKbTree.push(`|- ${foundName} [x Read Failed]`);
    } else if (msg.includes("Repo ingestion complete")) {
      stepPgr = 100;
      innerPhase = "Complete";
      newKbTree.push(`|- ${foundName} [✓ Completed]`);
    } else if (msg.includes("Cloning")) {
      stepPgr = 10;
      innerPhase = "Cloning...";
    } else if (msg.includes("Pulling")) {
      stepPgr = 10;
      innerPhase = "Pulling...";
      newKbTree.push(`|- ${foundName} [Git Pull]`);
    } else if (msg.includes("flattening")) {
      stepPgr = 40;
      innerPhase = "Flattening Source";
      newKbTree.push(`|- ${foundName}/source_tree.txt (flattened)`);
    } else if (msg.includes("embedding architecture")) {
      stepPgr = 60;
      innerPhase = "Embedding Code...";
    } else if (msg.includes("Summarizing")) {
      stepPgr = 85;
      innerPhase = "LLM Summarization...";
      newKbTree.push(`|- ${foundName}/embeddings.index`);
      newKbTree.push(`|- ${foundName}/chunked_summaries.json (generating)`);
    }

    const now = Date.now();
    const started = newReposProgress[foundName].timeStarted || now;
    const elapsedSec = (now - started) / 1000;
    let eta = 45;
    if (stepPgr === 100) {
      eta = 0;
    } else if (stepPgr > 0) {
      const totalEstimated = elapsedSec / (stepPgr / 100);
      eta = Math.max(15, totalEstimated - elapsedSec);
    } else {
      eta = 60;
    }

    newReposProgress[foundName] = { ...newReposProgress[foundName], progress: stepPgr, currentPhaseProgress: stepPgr, phase: innerPhase, etaSeconds: Math.round(eta), timeStarted: started };
  }

  if (msg.includes("Found") && msg.includes("target repositories")) {
    phase = "Preparing Repository Ingestion..."; pgr = 5;
  } else if (msg.includes("Fetching GitHub repos")) {
    phase = "Fetching Repositories..."; pgr = 2;
  } else if (msg.includes("Generating project vector embeddings")) {
    phase = "Initializing Variables..."; pgr = 0;
  } else if (msg.includes("Database RAG Vectors loaded")) {
    phase = "Context Ready"; pgr = 100;
  } else if (msg.includes("Extracting skills and experiences")) {
    phase = "Extracting Relational Entities..."; pgr = 95;
  } else if (msg.includes("Entities extraction failed")) {
    phase = "Extraction Finished (With Error)"; pgr = 100;
  }

  return { logs: [...state.logs, msg], progress: pgr, currentPhase: phase, reposProgress: newReposProgress, knowledgeBaseTree: newKbTree };
}
