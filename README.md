<div align="center">
  <img src="logo.png" alt="MainCurriculum Logo" width="200" />
</div>

# MainCurriculum - Autonomous AI Engineer Portfolio Orchestrator

MainCurriculum is an elite, intelligent, and autonomous AI-driven curriculum and portfolio generator. It acts as an orchestrator, securely ingesting your GitHub codebase and raw text CV to construct a highly localized semantic **Knowledge Graph** of your career. Through a rigorous 5-layer critique system and a deep-dive "Principal Engineer" style technical interview, it perfectly aligns your resume points to your actual codebase reality, producing a verifiable, highly technical Master CV.

## 🏗️ Architecture & Component Diagrams

To fully grasp the scale and implementation of MainCurriculum, review the 10 architecture diagrams below outlining the exact data flows, LLM utilization, and state orchestrations.

### 1. High-Level System Architecture

The foundational architecture blending the local client environment with remote intelligence.

```mermaid
graph TD
    Client[Client Browser]
    IDB[(IndexedDB Knowledge Graph)]
    GitHub[GitHub API]
    LLM[Google Gemini API]
    
    Client -->|Authenticates| GitHub
    GitHub -->|Returns Codebase Trees| Client
    Client -->|Stores Extracted JSON| IDB
    Client -->|Queries| LLM
    LLM -->|Extracts/Critiques| Client
    IDB -->|Hydrates Context| Client
```

### 2. Unified Orchestrator Pipeline Flow

The core user journey from initial configuration to the final Master Portfolio generation.

```mermaid
flowchart TD
    Start((Start)) --> Phase1_ConfigSetup[Phase 1: Config Setup]
    Phase1_ConfigSetup -->|GitHub Token & Config| Phase2_RepoIngestion[Phase 2: Repo Ingestion]
    Phase2_RepoIngestion -->|Repos Parsed & Embedded| Phase3_CvSubmission[Phase 3: CV Submission]
    Phase3_CvSubmission -->|Raw CV Received| Phase4_UnifiedOrchestrator
    
    subgraph Phase4_UnifiedOrchestrator [Phase 4: Unified Orchestrator]
        direction TB
        Extract[Raw Entity Extraction] --> Critique[5-Layer Critique Engine]
        Critique -->|Gap Detected| MissingContext[Missing Context]
        MissingContext --> Chat[User Provides Clarification]
        Chat --> Critique
        Critique -->|Pass| ValidationPassed[Validation Passed]
        ValidationPassed --> DeepDive[Technical Deep Dive Interview]
    end
    
    Phase4_UnifiedOrchestrator -->|Master CV Generated| Done((End))
```

### 3. The 5-Layer Critique Engine

The defining feature of MainCurriculum. Before the AI accepts any CV claim, it validates it across five rigorous logical semantic layers.

```mermaid
flowchart TD
    RawDB[(Unvalidated DB Graph)]
    
    Layer1{Layer 1: Truthfulness}
    Layer2{Layer 2: Codebase Corroboration}
    Layer3{Layer 3: Depth/Context}
    Layer4{Layer 4: Formatting}
    Layer5{Layer 5: STAR Method}
    
    RawDB --> Layer1
    Layer1 -->|Pass| Layer2
    Layer2 -->|Pass| Layer3
    Layer3 -->|Pass| Layer4
    Layer4 -->|Pass| Layer5
    
    Layer1 -->|Gap Detected| Halt
    Layer2 -->|Gap Detected| Halt
    Layer3 -->|Gap Detected| Halt
    Layer4 -->|Format Issue| AutoPatch
    Layer5 -->|Missing Result| Halt
    
    AutoPatch --> Layer5
    Halt[USER_INPUT_REQUIRED] --> AskUser(Ask User for Context)
```

### 4. LLM Model Allocation Strategy

We utilize different tiers of models to balance computational speed with high-intelligence reasoning.

```mermaid
graph LR
    subgraph Extraction Phase
        CV[Raw Text] -->|gemini-1.5-flash-latest| JSON[Structured JSON]
        Code[Source Code] -->|gemini-1.5-flash-latest| Skills[Tech Stack JSON]
    end
    
    subgraph Intelligence Phase
        JSON -->|gemini-1.5-pro-latest| Critique[5-Layer Orchestrator]
        Critique -->|gemini-1.5-pro-latest| Interview[Deep-Dive Technical Interview]
    end
```

### 5. Semantic Vector Embedding Lifecycle

All extracted codebase chunks and resume entities are embedded to allow instantaneous corroboration.

```mermaid
sequenceDiagram
    participant Pipeline
    participant FlashModel
    participant IDB
    
    Pipeline->>FlashModel: Send Raw Markdown CV
    FlashModel-->>Pipeline: Return Structured JSON (Educations, Experiences)
    Pipeline->>Pipeline: Parse JSON into Entity Nodes
    Pipeline->>FlashModel: Generate Vertex Embedding (768d) for Entity Text
    FlashModel-->>Pipeline: Return Float Array
    Pipeline->>IDB: Save Object + `{ embedding: [...] }`
```

### 6. Relational IndexedDB Schema

Our local database structures the unstructured AI chaos into highly relational, durable graph data.

```mermaid
erDiagram
    UserProfile ||--o{ Experience : has
    UserProfile ||--o{ Education : has
    UserProfile ||--o{ Project : owns
    Experience }|--|{ Skill : uses
    Project }|--|{ Skill : uses
    Project ||--o{ EmbeddingChunk : contains
    
    UserProfile {
        string github_handle
        string base_cv
        array interview_history
    }
    Project {
        string repo_name
        string raw_text
    }
    Experience {
        string role
        string start_date
        string end_date
    }
```

### 7. Zustand State Management Architecture

The React application heavily relies on modular `zustand` stores to persist decoupled pipeline state.

```mermaid
graph TD
    App[React UI]
    
    subgraph Zustand Stores
        PipelineStore[Pipeline Store: Phase routing & logs]
        ProfileStore[Profile Store: CV & API Tokens]
        EntityStore[Entity Store: Target Repos & DB Sync]
        InterviewStore[Interview Store: Q&A History]
    end
    
    App <--> PipelineStore
    App <--> ProfileStore
    App <--> EntityStore
    App <--> InterviewStore
    
    PipelineStore -.-> InterviewStore: Phase transitions
```

### 8. Interactive Orchestrator Chat Loop

When the Orchestrator stalls on a gap, it enters a `CritiqueLoop` chat interface inside the UI, patching the DB upon successful responses.

```mermaid
sequenceDiagram
    participant User
    participant Chat UI
    participant Orchestrator
    participant DB
    
    Orchestrator->>Chat UI: "USER_INPUT_REQUIRED: Explain the 1-year date gap in 2021."
    Chat UI->>User: Renders prompt
    User->>Chat UI: "I took a sabbatical to build Project X."
    Chat UI->>Orchestrator: Submit Answer
    Orchestrator->>DB: Re-evaluates Constraints, Patches Timeline
    Orchestrator->>Chat UI: "Validation Passed."
    Chat UI->>User: Initiates Interview Step 1
```

### 9. Deep-Dive Architect Interview Flow

Instead of generic "HR" questions, the pipeline uses semantic targeting to grill the candidate on complex software architecture tradeoffs based directly on their actual repositories.

```mermaid
flowchart TD
    Start[Init Interview Loop 1 to 5]
    FindTarget[Fetch Entity sorted by complexity]
    Prompt[Generate stark, technical question with Context]
    
    Start --> FindTarget
    FindTarget --> Prompt
    Prompt --> UserAnswers(User Provides Architectural Insight)
    UserAnswers --> AI_Eval{Is context sufficient?}
    AI_Eval -->|No| Reroute[Restructure question directly]
    Reroute --> Prompt
    AI_Eval -->|Yes| Refine[Instantly refine into professional prose]
    Refine --> Save[Append to DB History]
    
    Save --> Next{Count < 5?}
    Next -->|Yes| FindTarget
    Next -->|No| ConstructCV[Construct Final Visual Portfolio]
```

### 10. Final Extrapolation & Assembly (Master CV)

The pipeline terminates by synthesizing everything acquired from the ingestion DB and the interview loop into a beautiful structural breakdown.

```mermaid
graph LR
    BaseCV[Base Markdown CV]
    InterviewH[Rich Architectural Interview History]
    Graph[Relational Skills/Project Graph]
    
    BaseCV --> Synthesizer(gemini-1.5-pro-latest)
    InterviewH --> Synthesizer
    Graph --> Synthesizer
    
    Synthesizer --> VisualCV[Master Extended CV output mapped to UI]
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Yarn or NPM
- A GitHub Personal Access Token (for codebase ingestion)
- A Google Gemini API Key

### Installation

1. **Clone the repo**

   ```bash
   git clone https://github.com/your-username/maincurriculum.git
   cd maincurriculum
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Start the Development Server (Vite)**

   ```bash
   yarn dev
   ```

4. Open `http://localhost:5173` and input your keys strictly into the local configuration. Data is strictly held via IndexedDB in your browser and never hits a centralized remote server aside from local LLM inference.
