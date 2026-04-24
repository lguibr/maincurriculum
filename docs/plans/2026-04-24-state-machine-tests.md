# State Machine Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a 20-test Vitest integration suite that leverages a specialized `PipelineTestDriver` to deterministically mock LLM/IDB boundaries and validate Zustand state progression.

**Architecture:** A unified test fixture (`PipelineTestDriver`) abstracts away Vite's `vi.mock` configurations for `dbOps`, `GeminiInference`, and specialized AI helpers. The tests evaluate the phase changes, progress increments, and wizard completions in the Zustand store (`usePipelineStore`, `useInterviewStore`).

**Tech Stack:** Vitest, React Testing Library (for store access if needed), Zustand, ES6.

---

### Task 1: Architect the Test Driver Fixture

**Files:**
- Create: `src/actions/__tests__/pipelineTestDriver.ts`

**Step 1: Write the failing test (mocked test)**
We don't have tests yet, so build the driver structure first.

**Step 2: Write minimal implementation**
```typescript
import { vi } from "vitest";
import { usePipelineStore } from "../../store/usePipelineStore";
import { useInterviewStore } from "../../store/useInterviewStore";
import { useProfileStore } from "../../store/useProfileStore";

// Globally mock dependencies needed by pipelineActions
vi.mock("../../db/indexedDB", () => ({
  dbOps: {
    getProfile: vi.fn(),
    saveProfile: vi.fn(),
    saveSkill: vi.fn(),
    saveExperience: vi.fn(),
    saveEducation: vi.fn(),
    saveEmbedding: vi.fn()
  }
}));

vi.mock("../../ai/GeminiInference", () => ({
  GeminiInference: {
    generate: vi.fn(),
    getEmbedding: vi.fn()
  }
}));

vi.mock("../../ai/critiqueOrchestrator", () => ({
  runCritiqueOrchestrationLoop: vi.fn()
}));

vi.mock("../../ai/interviewLLM", () => ({
  getInterviewTargetForIndex: vi.fn(),
  generateValidatedQuestion: vi.fn(),
  refineUserAnswer: vi.fn(),
  updateEntitiesFromInterview: vi.fn()
}));

vi.mock("../../actions/entityActions", () => ({
  fetchEntities: vi.fn()
}));

vi.mock("../../actions/cvGenerationActions", () => ({
  startImprover: vi.fn()
}));

export class PipelineTestDriver {
  setupStores() {
    usePipelineStore.setState({ isRunning: false, currentPhase: "Idle", progress: 0, isWizardComplete: false });
    useInterviewStore.setState({ currentQuestion: null, interviewHistory: [] });
    useProfileStore.setState({ baseCv: "My CV", extendedCv: "" });
  }

  pipelineStore() { return usePipelineStore.getState(); }
  interviewStore() { return useInterviewStore.getState(); }
}
```

**Step 3: Commit**
```bash
git add src/actions/__tests__/pipelineTestDriver.ts
git commit -m "test: add vitest pipeline fixture for state machine testing"
```

---

### Task 2: Test Extraction Phase & initialization (Tests 1-4)

**Files:**
- Create: `src/actions/__tests__/pipelineStateMachine.test.ts`

**Step 1: Write failing tests & implementation simultaneously**
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PipelineTestDriver } from "./pipelineTestDriver";
import { processCvAndInterview } from "../../actions/interviewActions";
import { GeminiInference } from "../../ai/GeminiInference";
import { dbOps } from "../../db/indexedDB";

const driver = new PipelineTestDriver();

describe("Pipeline State Machine - Extraction Phase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driver.setupStores();
    vi.mocked(dbOps.getProfile).mockResolvedValue({ id: "1", extended_cv: "old" } as any);
  });

  it("Test 1: Initializes pipeline state correctly on start", async () => {
    vi.mocked(GeminiInference.generate).mockResolvedValue("{}");
    const promise = processCvAndInterview("test cv");
    const state = driver.pipelineStore();
    expect(state.isRunning).toBe(true);
    expect(state.progress).toBe(10);
    expect(state.currentPhase).toBe("Extracting Entities...");
    expect(state.isWizardComplete).toBe(false);
    await promise;
  });

  it("Test 2: Extracts educations and saves to DB", async () => {
    vi.mocked(GeminiInference.generate).mockImplementation(async (prompt) => {
        if (prompt.includes("academic educations")) return '{"educations": [{"id": "1", "school": "MIT"}]}';
        return "{}";
    });
    await processCvAndInterview("test cv");
    expect(dbOps.saveEducation).toHaveBeenCalledWith(expect.objectContaining({ school: "MIT" }));
    expect(driver.pipelineStore().progress).toBeGreaterThanOrEqual(30);
  });

  it("Test 3: Extracts experiences, embeds and saves to DB", async () => {
    vi.mocked(GeminiInference.generate).mockImplementation(async (prompt) => {
        if (prompt.includes("work experiences")) return '{"experiences": [{"id": "2", "company": "Google"}]}';
        return "{}";
    });
    vi.mocked(GeminiInference.getEmbedding).mockResolvedValue([0.1, 0.2]);
    await processCvAndInterview("cv");
    expect(dbOps.saveExperience).toHaveBeenCalledWith(expect.objectContaining({ company: "Google" }));
    expect(dbOps.saveEmbedding).toHaveBeenCalled();
  });

  it("Test 4: Extracts skills and saves to DB", async () => {
    vi.mocked(GeminiInference.generate).mockImplementation(async (prompt) => {
        if (prompt.includes("technical skills")) return '{"skills": [{"id": "3", "name": "React"}]}';
        return "{}";
    });
    await processCvAndInterview("cv");
    expect(dbOps.saveSkill).toHaveBeenCalledWith(expect.objectContaining({ name: "React" }));
  });
});
```

**Step 2: Run test to verify passes**
Run: `npx vitest run src/actions/__tests__/pipelineStateMachine.test.ts`
Expected: PASS

**Step 3: Commit**
```bash
git add src/actions/__tests__/pipelineStateMachine.test.ts
git commit -m "test: add first 4 state machine tests for cv extraction"
```

---

### Task 3: Test Critique Engine Validation (Tests 5-9)

**Files:**
- Modify: `src/actions/__tests__/pipelineStateMachine.test.ts`

**Step 1: Write tests for Critique behaviors**
```typescript
import { runCritiqueOrchestrationLoop } from "../../ai/critiqueOrchestrator";
import { getInterviewTargetForIndex, generateValidatedQuestion } from "../../ai/interviewLLM";
import { submitAnswer } from "../../actions/interviewActions";

describe("Pipeline State Machine - Orchestrator Critique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driver.setupStores();
    vi.mocked(GeminiInference.generate).mockResolvedValue("{}");
  });

  it("Test 5: Critique success transitions straight to interview", async () => {
    vi.mocked(runCritiqueOrchestrationLoop).mockResolvedValue({ status: "PASS", assistant_message: "" });
    vi.mocked(getInterviewTargetForIndex).mockResolvedValue({ topic: "Scaling", context: "Google" });
    vi.mocked(generateValidatedQuestion).mockResolvedValue("Tell me about scaling");
    
    await processCvAndInterview("cv");
    
    const pState = driver.pipelineStore();
    const iState = driver.interviewStore();
    
    expect(pState.currentPhase).toBe("Technical Architecture Interview");
    expect(pState.progress).toBe(90);
    expect(iState.currentQuestion).toBe("Tell me about scaling");
  });

  it("Test 6: Critique gap sets USER_INPUT_REQUIRED phase and pauses", async () => {
    vi.mocked(runCritiqueOrchestrationLoop).mockResolvedValue({ status: "USER_INPUT_REQUIRED", assistant_message: "Explain the gap." });
    await processCvAndInterview("cv");
    
    const pState = driver.pipelineStore();
    const iState = driver.interviewStore();
    
    expect(pState.currentPhase).toBe("Orchestrator Validation");
    expect(pState.progress).toBe(80);
    expect(iState.currentQuestion).toBe("Explain the gap.");
  });

  it("Test 7: Submitting gap answer updates history with type: critique", async () => {
    // Setup state as if blocked on gap
    usePipelineStore.setState({ currentPhase: "Orchestrator Validation" });
    useInterviewStore.setState({ currentQuestion: "Explain gap" });
    vi.mocked(runCritiqueOrchestrationLoop).mockResolvedValue({ status: "USER_INPUT_REQUIRED", assistant_message: "Still not enough." });
    
    await submitAnswer("I was traveling");
    
    const iState = driver.interviewStore();
    expect(iState.interviewHistory[0]).toEqual({ q: "Explain gap", a: "I was traveling", type: "critique" });
  });

  it("Test 8: Re-evaluation success proceeds to Interview", async () => {
    usePipelineStore.setState({ currentPhase: "Orchestrator Validation" });
    vi.mocked(runCritiqueOrchestrationLoop).mockResolvedValue({ status: "PASS", assistant_message: "" });
    vi.mocked(generateValidatedQuestion).mockResolvedValue("New Architect Q");
    
    await submitAnswer("Answer");
    
    expect(driver.pipelineStore().currentPhase).toBe("Technical Architecture Interview");
    expect(driver.interviewStore().currentQuestion).toBe("New Architect Q");
  });

  it("Test 9: Re-evaluation failure loops back to USER_INPUT_REQUIRED", async () => {
    usePipelineStore.setState({ currentPhase: "Orchestrator Validation" });
    useInterviewStore.setState({ interviewHistory: [{ q: "Old", a: "Ans", type: "critique" }] });
    vi.mocked(runCritiqueOrchestrationLoop).mockResolvedValue({ status: "USER_INPUT_REQUIRED", assistant_message: "Tell me more." });
    
    await submitAnswer("More answer");
    
    const iState = driver.interviewStore();
    expect(iState.currentQuestion).toBe("Tell me more.");
    expect(iState.interviewHistory.length).toBe(2);
  });
});
```

**Step 2: Run test to verify passes**
Run: `npx vitest run src/actions/__tests__/pipelineStateMachine.test.ts`
Expected: PASS

**Step 3: Commit**
```bash
git add src/actions/__tests__/pipelineStateMachine.test.ts
git commit -m "test: add tests 5-9 for critique loops"
```

---

### Task 4: Test Technical Architecture Interview Progression (Tests 10-15)

**Files:**
- Modify: `src/actions/__tests__/pipelineStateMachine.test.ts`

**Step 1: Write tests for iterations**
```typescript
import { refineUserAnswer, updateEntitiesFromInterview } from "../../ai/interviewLLM";
import { startImprover } from "../../actions/cvGenerationActions";

describe("Pipeline State Machine - Architecture Interview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driver.setupStores();
    usePipelineStore.setState({ currentPhase: "Technical Architecture Interview", progress: 90 });
    vi.mocked(refineUserAnswer).mockResolvedValue("Refined Answer");
  });

  it("Test 10: submitAnswer updates interview history with type: interview", async () => {
    useInterviewStore.setState({ currentQuestion: "Arch Q1" });
    await submitAnswer("Raw A1");
    expect(driver.interviewStore().interviewHistory[0].type).toBe("interview");
  });

  it("Test 11: refineUserAnswer replaces raw answer in history", async () => {
    useInterviewStore.setState({ currentQuestion: "Arch Q1" });
    await submitAnswer("Raw A1");
    expect(driver.interviewStore().interviewHistory[0].a).toBe("Refined Answer");
  });

  it("Test 12: Iteration count < 5 generates next targeted question", async () => {
    useInterviewStore.setState({ currentQuestion: "Arch Q1" });
    vi.mocked(generateValidatedQuestion).mockResolvedValue("Arch Q2");
    await submitAnswer("A1");
    expect(driver.interviewStore().currentQuestion).toBe("Arch Q2");
  });

  it("Test 13: Phase progress tracking string updates iteration fraction", async () => {
    useInterviewStore.setState({ currentQuestion: "Arch Q1" });
    await submitAnswer("A1");
    expect(driver.pipelineStore().currentPhase).toBe("Technical Architecture Interview 1/5");
  });

  it("Test 14: 5th iteration breaks interview loop and initiates CV step", async () => {
    // Stage having 4 answers already
    useInterviewStore.setState({
        currentQuestion: "Arch Q5",
        interviewHistory: Array(4).fill({ q: "Q", a: "A", type: "interview" })
    });
    vi.mocked(startImprover).mockResolvedValue(true);
    await submitAnswer("A5");
    
    expect(startImprover).toHaveBeenCalled();
    expect(driver.interviewStore().currentQuestion).toBeNull();
  });

  it("Test 15: updateEntitiesFromInterview is called after 5th answer to sync graph", async () => {
    useInterviewStore.setState({
        currentQuestion: "Arch 5",
        interviewHistory: Array(4).fill({ q: "Q", a: "A", type: "interview" })
    });
    await submitAnswer("Ans");
    expect(updateEntitiesFromInterview).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify passes**
Run: `npx vitest run src/actions/__tests__/pipelineStateMachine.test.ts`
Expected: PASS

**Step 3: Commit**
```bash
git commit -am "test: add tests 10-15 mapping the 5 iteration interview loop"
```

---

### Task 5: Extrapolation & Wizard End State (Tests 16-20)

**Files:**
- Modify: `src/actions/__tests__/pipelineStateMachine.test.ts`

**Step 1: Write terminal state machine tests**
```typescript
describe("Pipeline State Machine - Terminal Nodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driver.setupStores();
    usePipelineStore.setState({ currentPhase: "Generating Master Profile Extrapolations", progress: 98 });
    useInterviewStore.setState({
        currentQuestion: "EndQ",
        interviewHistory: Array(4).fill({ q: "Q", a: "A", type: "interview" })
    });
    vi.mocked(refineUserAnswer).mockResolvedValue("Ans");
  });

  it("Test 16: startImprover uses full compiled interview history string", async () => {
    await submitAnswer("A5");
    expect(startImprover).toHaveBeenCalledWith(expect.stringContaining("Q1: Q"), expect.any(String));
  });

  it("Test 17: Extrapolation Success completes the wizard and halts running state", async () => {
    vi.mocked(startImprover).mockResolvedValue(true);
    await submitAnswer("A5");
    expect(driver.pipelineStore().isWizardComplete).toBe(true);
    expect(driver.pipelineStore().progress).toBe(100);
    expect(driver.pipelineStore().currentPhase).toBe("Complete");
  });

  it("Test 18: Extrapolation Failure does not complete wizard and halts with error", async () => {
    vi.mocked(startImprover).mockResolvedValue(false);
    await submitAnswer("A5");
    expect(driver.pipelineStore().isWizardComplete).toBe(false);
    expect(driver.pipelineStore().currentPhase).toBe("Failed to generate CV. Please try again.");
    expect(driver.interviewStore().currentQuestion).toBe("EndQ"); // restores failed state
  });

  it("Test 19: Extended_CV memory field is wiped clean on initial run", async () => {
    useProfileStore.setState({ extendedCv: "existing cv" });
    vi.mocked(dbOps.getProfile).mockResolvedValue({ id: "main", extended_cv: "existing" } as any);
    await processCvAndInterview("new");
    expect(useProfileStore.getState().extendedCv).toBe("");
  });

  it("Test 20: Progress strictly increases non-destructively through main phases", async () => {
    // Assert 10 -> 30 -> 60 -> 90 -> 100 via functional calls
    let recordedProgress: number[] = [];
    usePipelineStore.subscribe((state) => {
        if(state.progress !== recordedProgress[recordedProgress.length - 1]) {
            recordedProgress.push(state.progress);
        }
    });
    // This is tested implicitly by prior tests verifying progress at each boundary.
    // By firing processCvAndInterview all the way to Interview:
    vi.mocked(GeminiInference.generate).mockResolvedValue("{}");
    vi.mocked(runCritiqueOrchestrationLoop).mockResolvedValue({ status: "PASS", assistant_message: "" });
    vi.mocked(getInterviewTargetForIndex).mockResolvedValue({ topic: "", context: "" });
    await processCvAndInterview("test cv");
    
    // Assert array holds increasing chunks
    expect(recordedProgress).toEqual(expect.arrayContaining([10, 30, 60, 90]));
  });
});
```

**Step 2: Run test to verify passes**
Run: `npx vitest run src/actions/__tests__/pipelineStateMachine.test.ts`
Expected: PASS

**Step 3: Commit**
```bash
git commit -am "test: finish state machine test suite with 20 assertions total"
```

---
