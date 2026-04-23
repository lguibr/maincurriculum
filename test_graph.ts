import { appGraph } from "./packages/backend/src/agent/graph.ts";
import { SINGLETON_THREAD_ID } from "./packages/backend/src/services/sse.service.ts";

async function test() {
  const events = appGraph.streamEvents(
      { githubHandle: "lgulbr", repositories: [{ name: "test", url: "https://github.com/lgulbr/test" }], currentPhase: "Initialize" },
      { version: "v2", recursionLimit: 15, configurable: { thread_id: "test_" + Date.now() } }
    );
  
  for await (const event of await events) {
    if (event.event === "on_custom_event") {
        console.log("CUSTOM EVENT DAta:", JSON.stringify(event));
    }
  }
}
test().catch(console.error);
