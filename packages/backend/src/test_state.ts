import { StateAnnotation } from "./agent/state";
console.log(Object.keys(StateAnnotation));
console.log("StateAnnotation.spec", StateAnnotation.spec ? Object.keys(StateAnnotation.spec) : "No spec");

import { StateGraph } from "@langchain/langgraph";
const g = new StateGraph(StateAnnotation);
console.log("Graph channels:", Object.keys(g.channels));
