import { Annotation } from "@langchain/langgraph";

const A = Annotation.Root({
  prop1: Annotation<string>({ reducer: (a,b) => b, default: () => "a" }),
  prop2: { reducer: (a,b) => b, default: () => "b" }
});

console.log("A.spec.prop1", A.spec.prop1);
console.log("A.spec.prop2", A.spec.prop2);
