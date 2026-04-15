import { profileIngestionGraph } from "./agent/graph";

async function run() {
  console.log("Starting graph execution test with stream()...");
  try {
    const stream = await profileIngestionGraph.stream(
      { githubUrl: "lgulbr", baseCv: "Test CV", githubHandle: "lgulbr" },
      { configurable: { thread_id: "test_thread_" + Date.now() } }
    );
    for await (const chunk of stream) {
      console.log("Chunk:", chunk);
    }
  } catch (err) {
    console.error("Graph Error:", err);
  }
}
run();
