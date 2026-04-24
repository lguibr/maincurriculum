# AI Interview Pipeline Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the Interview Pipeline in `pipelineActions.ts` to implement a 10-question flow structured by domain (Education, Skills, Projects, Experiences). Implement an internal "Self-Answering LLM Loop" that tries to answer questions using existing DB context before asking the user. Also, automatically refine poor user answers using the selected primary model.

**Architecture:**
- **Model Standard**: Use the user's selected `cloudTier` ("smart" = `gemini-pro-latest`) across ALL question generation and evaluation tasks.
- **Topical 10-Question Flow**: 
  - Q1: Education
  - Q2-Q3: Skills
  - Q4-Q6: Projects
  - Q7-Q10: Experiences
- **Internal Loop Function**: `generateValidatedQuestion(topic, context)`
  - Iterates up to 3 times.
  - Generates a deep technical question.
  - Tests the question against the existing CV/Entities context via LLM.
  - If the LLM can answer it perfectly based on the context, it loops and tries a harder question.
  - If the LLM hits a gap ("INSUFFICIENT_CONTEXT"), it restructures the question to extract that missing context from the user.
- **Answer Refinement**: Upon `submitAnswer`, an LLM pass intercepts the raw user answer and refines it into a professional, dense response before appending it to `interviewHistory`.

---

### Task 1: Create the Inner AI Logic in `pipelineActions.ts`

**Files:**
- Modify: `src/actions/pipelineActions.ts`

**Step 1: Create `generateValidatedQuestion` helper**

Define a function outside the stores that takes `(topic: string, cvContext: string, history: string, model: string)` and executes the LLM loop logic.

```typescript
async function generateValidatedQuestion(topic: string, cvContext: string, history: string, model: string): Promise<string> {
    let maxLoops = 3;
    let finalQuestion = "";
    
    for (let attempts = 0; attempts < maxLoops; attempts++) {
        // 1. Generate Candidate Question
        const qPrompt = `You are an elite Staff Engineer interviewing a candidate.
Topic focus: ${topic}. 
Context: ${cvContext}
History: ${history}

Generate ONE incredibly specific, deep-dive technical question probing architectural decisions, trade-offs, or complex edge cases related to ${topic}. Do not repeat history. Output ONLY the question.`;
        
        let candidateQ = await GeminiInference.generate(qPrompt, "text", model);
        
        // 2. AI tries to answer it itself
        const answerPrompt = `You are a strict evaluator. Attempt to thoroughly answer the following question relying EXCLUSIVELY on the provided Candidate Context.
Context: ${cvContext}
Question: ${candidateQ}

If the context lacks the specific technical depth, metrics, or architectural details to answer fully, reply EXACTLY with "INSUFFICIENT_CONTEXT". Otherwise, provide the answer.`;
        
        const aiAnswer = await GeminiInference.generate(answerPrompt, "text", model);
        
        if (aiAnswer.includes("INSUFFICIENT_CONTEXT")) {
           // 3. Gap found. Restructure and lock in.
           const restructurePrompt = `A gap was found in the candidate's context regarding this question: ${candidateQ}
Rewrite the question to specifically ask the candidate to fill in this missing knowledge. Be professional, direct, and elite. Output ONLY the question text.`;
           finalQuestion = await GeminiInference.generate(restructurePrompt, "text", model);
           break;
        } else {
           // AI answered it! Loop again.
           if (attempts === maxLoops - 1) {
              finalQuestion = candidateQ; 
           }
        }
    }
    return finalQuestion;
}
```

**Step 2: Add Answer Refiner helper**
```typescript
async function refineUserAnswer(question: string, rawAnswer: string, model: string): Promise<string> {
    const prompt = `The user was asked an elite technical interview question: "${question}"
They provided this raw answer: "${rawAnswer}"

Act as a Principal Engineer. Rewrite, sharpen, and professionalize this answer so it fits perfectly as a dense, high-impact bullet point or executive summary in a Master CV. Improve the vocabulary but preserve the core truth. Output ONLY the refined answer.`;
    return await GeminiInference.generate(prompt, "text", model);
}
```

### Task 2: Refactor `processCvAndInterview` & `submitAnswer`

**Step 1: Process CV (Triggering Q1 - Education)**
- Determine model logic (`"smart"` -> `gemini-pro-latest` or `gemini-1.5-pro-latest`, or we can just use the latest pro).
- Pass the full CV string to `generateValidatedQuestion` with `topic="Education"`.

**Step 2: Submit Answer Flow**
- In `submitAnswer`, before pushing to history, intercept `answer` -> `await refineUserAnswer(prevQ, answer, model)`.
- Push refined answer to history.
- Check `newHistory.length`. Select topic based on index:
  - length == 1, 2: `topic = "Technical Skills (Languages, Frameworks)"`
  - length == 3, 4, 5: `topic = "Specific Repositories and Projects"`
  - length == 6, 7, 8, 9: `topic = "Professional Work Experience and Architecture"`
- Call `generateValidatedQuestion` for the next question.
- At length == 10, trigger `startImprover` to generate the final CV using the beautifully refined history.

**Step 3: Commit**
```bash
git add src/actions/pipelineActions.ts
git commit -m "feat: ai interview refactor with self-validation loop"
```

---
