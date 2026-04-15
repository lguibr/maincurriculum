import { profileIngestionGraph } from "./agent/graph";

async function run() {
  console.log("Starting graph execution test...");
  try {
    const stream = await profileIngestionGraph.streamEvents(
      { githubUrl: "lgulbr", baseCv: "Test CV", githubHandle: "lgulbr" },
      { version: "v2", configurable: { thread_id: "test_thread_" + Date.now() } }
    );
    for await (const event of stream) {
      if (event.event === "on_custom_event") {
        console.log("Custom event:", event.data.msg);
      }
    }
    const state = await profileIngestionGraph.getState({ configurable: { thread_id: "test_thread_" + Date.now() } });
    console.log("Final State:", state);
  } catch (err) {
    console.error("Graph Error:", err);
  }
}
run();
