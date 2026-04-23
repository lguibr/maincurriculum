import { appGraph } from "./packages/backend/src/agent/graph";
import { SINGLETON_THREAD_ID } from "./packages/backend/src/services/sse.service";

async function main() {
  const events = appGraph.streamEvents(
    { githubHandle: "lgulbr", repositories: [{ name: "daicer-ui", url: "https://github.com/lgulbr/daicer-ui", updatedAt: "2026-04-14T16:46:40Z" }], currentPhase: "Initialize" },
    { version: "v2", recursionLimit: 15, configurable: { thread_id: "test_" + Date.now() } }
  );
  
  for await (const evt of events) {
    if (evt.event === "on_custom_event") {
      console.log("CUSTOM EVENT:", JSON.stringify(evt.data));
    }
  }
}
main().catch(console.error);
