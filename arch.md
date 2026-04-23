# Setup and Analysis

The system is orchestrated by a unified LangGraph app state machine.

Below are 20+ mermaid diagrams mapping out all agents, tools, LLM calls, prompts, and flows in detail.

## 1. High-Level Agent Architecture

```mermaid
flowchart TD
    UI[Frontend Client] <--> API[Backend API]
    API <--> SG[Main Supervisor Graph]
    SG <--> DB[(PostgreSQL)]
    SG <--> OLLAMA((Ollama LLM\ngemma4))
    SG <--> HUG[(Xenova Embeddings)]
    
    subgraph Agents
        ING[Ingestion Subgraph]
        INT[Interviewer Subgraph]
        IMP[Improver Subgraph]
    end
    
    SG --> ING
    SG --> INT
    SG --> IMP
```

## 2. Main Supervisor LangGraph Topology

```mermaid
stateDiagram-v2
    [*] --> Supervisor
    Supervisor --> Persister: pendingDbWrites > 0
    Supervisor --> IngestionAgent: New / Has Github
    Supervisor --> ImproverAgent: currentPhase = 'Improver'
    Supervisor --> InterviewerAgent: missingCount > 0 / Interviewing
    Supervisor --> [*]: Wait / End
    
    IngestionAgent --> Supervisor
    IngestionAgent --> Persister
    InterviewerAgent --> Supervisor
    InterviewerAgent --> Persister
    ImproverAgent --> Supervisor
    ImproverAgent --> Persister
    Persister --> Supervisor
```

## 3. Supervisor Routing Logic Decision Tree

```mermaid
flowchart TD
    Start[Supervisor Called] --> CheckDB{Pending DB Writes?}
    CheckDB -- Yes --> RoutePersister[Route: Persister]
    CheckDB -- No --> CheckUser{Has Profile ID?}
    
    CheckUser -- No --> RouteInit[Initialize Phase\nWrite DB]
    CheckUser -- Yes --> CheckWait{Phase = Awaiting CV?}
    
    CheckWait -- Yes --> RouteEnd[Route: END]
    CheckWait -- No --> CheckInit{Phase = Initialize\nor fresh Git?}
    
    CheckInit -- Yes --> RouteIngest[Route: IngestionAgent]
    CheckInit -- No --> CheckImp{Phase = Improver?}
    
    CheckImp -- Yes --> RouteImpro[Route: ImproverAgent]
    CheckImp -- No --> CheckInt{Phase = Ontology / \nMissing Info / Answer}
    
    CheckInt -- Yes --> RouteInterv[Route: InterviewerAgent]
    CheckInt -- No --> RouteEnd2[Route: END]
```

## 4. Ingestion Subgraph Data Flow

```mermaid
flowchart TD
    Start[ingestionSubGraph] --> CheckRepos{Has Repos?}
    CheckRepos -- No --> FetchGithub[Fetch from GitHub API]
    FetchGithub --> Filter[Filter Non-Forks]
    CheckRepos -- Yes --> LoopRepos[Loop Repositories]
    Filter --> LoopRepos
    
    subgraph processRepo
        Clone[Git Clone] --> Repomix[Repomix Flattening]
        Repomix --> Embed[Context Embedding]
        Embed --> LLMSum[LLM Summarization]
        LLMSum --> FinalDB[Upsert to DB]
    end
    
    LoopRepos --> processRepo
    processRepo --> EndNode[Return DB Directives\nCurrentPhase = Awaiting CV]
```

## 5. Embedder Pipeline Sequence

```mermaid
sequenceDiagram
    participant Process as Ingestion
    participant Splitter as LangChain TextSplitter
    participant Model as Xenova/all-MiniLM-L6-v2
    participant DB as Postgres

    Process->>Splitter: Split raw text (chunk_size=4000)
    Splitter-->>Process: Document Chunks
    Process->>Model: Initialize Local Pipeline
    Process->>Model: Embed query ("architecture tech stack...")
    Model-->>Process: Query Vector
    loop Batches of 16 chunks
        Process->>Model: Embed chunks
        Model-->>Process: Chunk Vectors
        Process-->>Process: Compute Cosine Similarity
        Process->>DB: Insert chunk & embedding
    end
```

## 6. Ingestion LLM Summarization Flow

```mermaid
flowchart TD
    Chunks(Context Chunks) --> Sort[Sort by Cosine Score]
    Sort --> TopK[Take Top 4 Chunks]
    TopK --> Join[Join into Text]
    
    SysPrompt[/System: You are a tech analyst. Summarize.../] --> LLM((Ollama gemma4\nTemp 0.1))
    UserPrompt[/User: Top relevant snippets: TopK/] --> LLM
    Join --> UserPrompt
    
    LLM --> Output[Summary Text]
    Output --> Upsert[(projects_raw_text DB)]
```

## 7. Interviewer Subgraph Topology

```mermaid
stateDiagram-v2
    [*] --> Extract_Entities
    Extract_Entities --> Evaluate_Completeness
    Evaluate_Completeness --> Improve_CV
    Improve_CV --> Direct_Interview
    Direct_Interview --> [*]
```

## 8. Interviewer: Entity Extraction (Database Dashboard)

```mermaid
flowchart LR
    StateInput(CV + Repo Summaries) --> Prompt
    Prompt[/System: Strict JSON extraction schema for skills and experiences/] --> Model((Ollama gemma4\nFormat: json\nTemp 0))
    Model --> Parsing[Parse & Validate JSON]
    Parsing --> RelationalWrites[(DB: skills, experiences,\nexperience_skills, project_skills)]
```

## 9. Interviewer: Structural Completeness Evaluation

```mermaid
sequenceDiagram
    participant Agent as Evaluate_Completeness
    participant LLM as Ollama (Structured Output)
    participant schema as OnboardingProfileSchema

    Agent->>LLM: System: COMPLETENESS_SYSTEM_PROMPT
    Agent->>LLM: User: CV and profile info
    LLM->>schema: Bind structured outputs
    schema-->>Agent: Parsed evaluation
    Agent-->>Agent: Update state (missingCount, missingInfoList)
```

## 10. Interviewer: Direct Interview & Interrupts

```mermaid
sequenceDiagram
    participant Agent as directInterview
    participant DB as Missing Areas
    participant LLM as Ollama (Structured Output)
    participant LangGraph as Interrupt Controller
    participant User as Frontend UI

    Agent->>DB: Get top missing area & history
    Agent->>LLM: Prompt + Target Area + History
    LLM-->>Agent: next_question_to_ask
    Agent->>LangGraph: interrupt({phase, question})
    note over LangGraph,User: Execution pauses here
    User->>LangGraph: User provides answer
    LangGraph-->>Agent: Resume with answer
    Agent-->>Agent: Update interviewHistory
```

## 11. Interviewer: Master CV Improvement

```mermaid
flowchart TD
    CheckHistory{Has answer?} -- No --> End[Return empty DB writes]
    CheckHistory -- Yes --> Format[Compile Base CV + Question + Answer]
    Prompt[/System: CV_IMPROVER_SYSTEM_PROMPT/] --> LLM((Ollama gemma4))
    Format --> LLM
    LLM --> Out[Updated CV Markdown]
    Out --> UpdateState[Return DB update to user_profiles]
```

## 12. Improver Subgraph Topology (Critique Fork-Join)

```mermaid
flowchart TD
    Start[Draft CV] --> Critique1[Critique Tone]
    Start --> Critique2[Critique Truth]
    Start --> Critique3[Critique Skills]
    Start --> Critique4[Critique Projects]
    Start --> Critique5[Critique Experiences]
    
    Critique1 --> Consolidate[Consolidate Feedback]
    Critique2 --> Consolidate
    Critique3 --> Consolidate
    Critique4 --> Consolidate
    Critique5 --> Consolidate
```

## 13. Improver: Draft CV with Context Tools

```mermaid
sequenceDiagram
    participant DraftCV
    participant DB
    participant LLM as Ollama (Tools)
    participant Tools as Vector Tools

    DraftCV->>DB: Compile Explicit Relational Context
    DraftCV->>LLM: System: CV_DRAFTER_PROMPT + Relational Context + Base CV
    loop Needs tools
        LLM-->>DraftCV: Tool Call Request
        DraftCV->>Tools: Invoke Tool (search Github or Query Skills)
        Tools-->>DraftCV: Tool Result
        DraftCV->>LLM: Return Data
    end
    LLM-->>DraftCV: Finished Draft Markdown
```

## 14. Vector Tools Sequence

```mermaid
sequenceDiagram
    participant Tool as querySkillsAndExperiences / searchGithub
    participant Embedder as EmbedderPipeline
    participant DB as Postgres Vector Search

    Tool->>Embedder: Embed Search Query String
    Embedder-->>Tool: Query Vector [1536 dims]
    Tool->>DB: pgvector cosine similarity search
    DB-->>Tool: Top matching rows (e.g. repo text, embeddings)
    Tool-->>Tool: Format as context string
```

## 15. Improver Critique Loop details

```mermaid
flowchart TD
    Draft[Draft CV Input] --> Prompt1[/CRITIQUE_TONE_PROMPT/]
    Prompt1 --> LLM1((Ollama))
    LLM1 --> Out1{PASS?}
    Out1 -- Yes --> Cvt1(Blank)
    Out1 -- No --> Add1(Add to Feedback)

    Draft --> PromptN[/CRITIQUE_TRUTH_PROMPT/]
    PromptN --> LLMN((Ollama w/ Tools))
    LLMN --> Tools[searchGithubProjectsTool]
    Tools --> FinalN{PASS?}
    FinalN -- No --> AddN(Add to Feedback)
```

## 16. Improver Consolidation Flow

```mermaid
flowchart LR
    Critiques(Array of Critique Responses) --> Check{Count > 0?}
    Check -- No --> OutPass[Save Current CV]
    Check -- Yes --> Prompt[/System: CRITIQUE_CONSOLIDATOR_PROMPT/]
    Prompt --> LLM((Ollama gemma4))
    LLM --> FixedCV[New Fixed Markdown]
    FixedCV --> OutFail[Save Fixed CV to DB]
```

## 17. LangGraph State Object Lifecycle

```mermaid
classDiagram
    class ProfileGraphState {
        githubUrl: string
        baseCv: string
        userProfileId: number
        workingExtendedCv: string
        critiqueFeedback: string[]
        repositories: array
        pendingDbWrites: array
        missingCount: number
        interviewHistory: array
        currentPhase: string
    }
```

## 18. Persister Execution Path

```mermaid
sequenceDiagram
    participant Subgraph
    participant State as Graph State Let (Reducer)
    participant Supervisor
    participant Persister
    participant DB as Postgres

    Subgraph->>State: Returns pendingDbWrites array
    State->>Supervisor: Injects to State
    Supervisor->>Persister: Routes to Persister node
    Persister->>DB: Loop through directives (INSERT/UPDATE/UPSERT)
    DB-->>Persister: Execution success
    Persister->>State: Return empty pendingDbWrites []
    Persister->>Supervisor: Loop back to Supervisor
```

## 19. Relational Entity ERD (Discovered Logic)

```mermaid
erDiagram
    user_profiles ||--o{ experiences : has
    user_profiles ||--o{ projects_raw_text : has
    experiences ||--o{ experience_skills : links
    skills ||--o{ experience_skills : links
    projects_raw_text ||--o{ project_embeddings : has
    projects_raw_text ||--o{ project_skills : links
    skills ||--o{ project_skills : links

    user_profiles {
        int id PK
        string github_handle
        string base_cv
        string extended_cv
    }
    skills {
        int id PK
        string name
        string type
    }
```

## 20. Total LLM Operations Table

```mermaid
mindmap
  root((Ollama gemma4 Calls))
    Ingestion Subgraph
      Summerizer (Temp 0.1)
    Interviewer Subgraph
      EntityExtractor JSON (Temp 0)
      CompletenessEvaluator (Struct Output)
      InterviewQuestionBuilder (Struct Output)
      CV_Improver Updater (Temp 1.0)
    Improver Subgraph
      CV_Drafter (Tools, Temp 0.7)
      Critique_Tone
      Critique_Truth (Tools)
      Critique_Skills (Tools)
      Critique_Projects
      Critique_Experiences
      Critique_Consolidator
```
