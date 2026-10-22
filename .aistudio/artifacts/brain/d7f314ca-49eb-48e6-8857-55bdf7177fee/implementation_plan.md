# Persistent Database & Long-Term Memory for Virtual Companion

Empower your AI voice companion (Zoya) with a persistent SQLite database and long-term memory engine that permanently remembers Abdul as its creator, tracks personal preferences, extracts memorable facts from past conversations, and injects context into both voice and text sessions.

> [!IMPORTANT]
> **Database Architecture Decision**:
> We recommend a **Full-Stack SQLite database (`better-sqlite3`) with Express API routes**, paired with client-side cache and automatic Gemini-powered memory extraction.
> - **Why this is the best option**: `better-sqlite3` and `express` are already installed in your project. SQLite delivers instantaneous sub-millisecond local querying, zero cloud account friction, reliable file-backed persistence on disk, and works seamlessly with full-stack Vite/Express.
> - **Creator Profile Pre-Configuration**: The database will be seeded with you (**Abdul**) as the recognized Creator & Primary User, so Zoya immediately recognizes you upon loading.

---

### 1. Overview & Core Concept

- **What It Does**: Upgrades the virtual companion from ephemeral local storage to a persistent relational database (SQLite). The companion permanently stores Abdul's identity, personal preferences, custom instructions, conversation logs, and automatically extracted memories (e.g., favorite foods, daily routines, projects, emotional milestones).
- **Target Persona**: Abdul (Creator & Developer) chatting naturally in voice or text with Zoya, with Zoya organically recalling previous discussions, nicknames, preferences, and creator status.
- **Key Value**: Every conversation builds upon past interactions. Even across reloads or server restarts, Zoya never forgets who you are or what you spoke about yesterday.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Recognition & Greeting**: On app start, Zoya greets Abdul with creator-level warmth, aware of his name and past discussions.
  2. **Memory Bank & Profile Modal**: A new futuristic "Memory & Brain" dashboard accessible from the header (brain/database icon) displaying:
     - **Creator Identity Card**: Name (Abdul), title (Creator), companion affinity.
     - **Remembered Preferences**: List of active preferences (e.g., language mix, conversational style, topics of interest, favorite things).
     - **Extracted Memories / Facts**: Categorized chips and cards (Personal, Work, Preferences, Inside Jokes) with one-click edit/delete and manual "Add Memory" entry.
     - **Past Conversation Sessions**: Searchable list of past conversations with session summaries and timestamps.
  3. **Real-Time Memory Consolidation**: After each chat exchange or voice session ends, a lightweight background job extracts new facts learned about Abdul and commits them to SQLite.
  4. **Active Memory Injection**: During both Gemini Chat (text) and Gemini Live (voice), memories and user preferences are dynamically injected into the system prompt context.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Cyber-tactile sci-fi companion interface matching existing Rajdhani typography, deep dark obsidian backdrop (`#02080b`), cyan accents (`#06b6d4`), and violet glowing borders (`#8b5cf6`).
  - *Clean Metadata*: Memory timestamps, categories, and confidence levels displayed as crisp typographic metadata (no generic rounded candy pills).
  - *Interactive Controls*: Segmented tabs (Memories, Preferences, Past Chats) with smooth subtle transitions.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: SQLite Server API vs. Pure Client Storage**
  - *Chosen Approach*: Full-stack server with SQLite (`better-sqlite3`) managed via an Express server (`server.ts`) serving Vite middleware in development and production.
  - *Why*: Client `localStorage` is fragile (limited to 5MB, easily wiped by browser clearing). SQLite gives true ACID durability, relational queries, and server-side background memory indexing.
  - *Alternatives Considered*: Cloud Firestore (adds complex authentication and permission flows when local SQLite is already fully supported in the project packages).

- **Decision 2: Memory Ingestion Pipeline**
  - *Chosen Approach*: Two-tiered memory:
    1. **Core Profile & Explicit Preferences**: Editable in UI and persistent in database.
    2. **Episodic & Semantic Memories**: Extracted asynchronously via Gemini Flash when conversations close or reach natural pauses, avoiding any latency during real-time speech.
  - *Why*: Keeps voice interaction sub-second and latency-free while memory analysis happens in the background.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (React 19)                      │
│                                                             │
│   ┌──────────────────┐  ┌────────────────┐  ┌───────────┐   │
│   │  Live Voice /    │  │ Memory Bank UI │  │ Chat View │   │
│   │  Audio Engine    │  │ & Preferences  │  │ & History │   │
│   └─────────┬────────┘  └────────┬───────┘  └─────┬─────┘   │
└─────────────┼────────────────────┼────────────────┼─────────┘
              │                    │                │
              ▼                    ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                Full-Stack Express API Server                │
│                                                             │
│  • GET/POST /api/memory       • GET/POST /api/preferences   │
│  • GET/POST /api/conversations • POST /api/memory/extract   │
│  • GET /api/creator/profile                                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 SQLite Database (better-sqlite3)            │
│                 File: data/companion_memory.db              │
│                                                             │
│  ┌────────────────────┐  ┌───────────────────────────────┐  │
│  │ creator_profile    │  │ preferences (key, value, cat) │  │
│  ├────────────────────┤  ├───────────────────────────────┤  │
│  │ conversations      │  │ memories (fact, category, ts) │  │
│  ├────────────────────┤  └───────────────────────────────┘  │
│  │ messages           │                                     │
│  └────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

#### Database Schema:
1. `creator_profile`: `id`, `name` ('Abdul'), `role` ('Creator'), `created_at`, `notes`.
2. `preferences`: `id`, `category`, `pref_key`, `pref_value`, `updated_at`.
3. `memories`: `id`, `fact`, `category` ('personal' | 'preference' | 'project' | 'general'), `source_conversation_id`, `created_at`.
4. `conversations`: `id`, `started_at`, `ended_at`, `summary`, `turn_count`.
5. `messages`: `id`, `conversation_id`, `sender` ('user' | 'zoya'), `text`, `timestamp`.

#### Memory Context Builder:
When launching a text or live voice session, the system queries the active memories and profile, formatting a concise `[CREATOR MEMORY CONTEXT]` block directly into the prompt:
- Recognized user: Abdul (Creator).
- Relevant facts and known preferences.
- Summary of last conversation topics.
