# FoundryVTT + Local LLM Dungeon Master — Project Plan

## Problem Statement

The user runs a FoundryVTT server at `10.0.40.10:30000` (on a homelab mini-PC) hosting a D&D game.
The server has **no resources** to run a local LLM. The goal is to create a **local LLM Dungeon
Master** that runs on the user's Mac, reads the Foundry game state, and pushes the narrative
forward — acting as a co-DM for solo play.

### Constraints
- **Local LLM** runs on the Mac (LM Studio), **not** on the Foundry server.
- The LLM must **not** hallucinate rules — mechanics are resolved deterministically.
- The LLM should focus on **narrative** (dialogue, descriptions, NPC voices, plot).
- A FoundryVTT **client module** bridges the two: it reads game state and relays it to the LLM.

### Locked decisions
- **Architecture (A): in-Foundry client module.** The module runs *inside* a GM browser session
  on the Mac and reads `game.*` directly. There is **no** external Foundry REST API / "API key" —
  that feature does not exist in core (it belongs to third-party relay modules, which we are not
  using).
- **Mechanics: reuse the `dnd5e` system API.** Do **not** hand-roll a 5e rules engine.

---

## Architecture Overview

```
┌────────────────────────────────────────────┐        ┌──────────────────┐
│  FoundryVTT (GM browser session on the Mac) │  HTTP  │  LM Studio (Mac) │
│                                              │ ─────► │  localhost:1234  │
│  Client module reads game.* directly:        │ ◄───── │  Qwen3.6-35B-A3B │
│   scenes, tokens, actors, chat, journal      │        │  (OpenAI API)    │
│                                              │        │                  │
│  dnd5e system resolves all mechanics         │        │  Generates       │
│  (rolls, HP, conditions, effects)            │        │  narrative + JSON│
└────────────────────────────────────────────┘        └──────────────────┘
        │                                                       │
        │  In-session reads (no auth — same client)             │  Narrative text +
        │  Writes narrative to chat; resolves intents via dnd5e  │  structured intents
        ▼                                                       ▼
   Foundry V13 client API                              Local quantized model (MLX/GGUF)
```

The Mac does **not** call into the Foundry server over HTTP. `game.scenes`, `game.actors`, etc.
only exist inside a connected GM client, so the module is client-side JS running in that session
and calls *out* to LM Studio on `localhost`.

### Key Design Principle: Separation of Concerns

| Layer | Responsibility |
|-------|---------------|
| **Foundry client module** | Read game state (tokens, scene, journal, chat). Write narrative to chat. Map LLM intents to dnd5e actions. |
| **Local LLM** | Generate narrative: descriptions, NPC dialogue, plot hooks, atmosphere. Emit **structured intents**. |
| **dnd5e system (reused)** | Resolve all mechanics: attack rolls, saves, skill checks, damage, HP, conditions, spell effects. |

The LLM **never** rolls dice or applies rules. It outputs **intent** (e.g., "the goblin attacks
Grom") as structured JSON, and the module translates that into dnd5e system calls. Mechanical
actions are **validated suggestions the GM confirms**, never blind writes.

---

## Phase 0 — De-risk spike (do this first)

The real first-week risk is **CORS / mixed-content**, not latency.

- Confirm the Mac browses Foundry over a scheme that permits calling `http://localhost:1234`
  (same-origin/http, or a reverse proxy). A browser module calling `http://localhost:1234` is
  blocked as mixed content if Foundry is served over HTTPS or accessed from a non-Mac device.
- Enable **CORS in LM Studio** (Developer settings → serve on local network / enable CORS).
- Minimal module: `console.log(game.scenes.current)` + a `fetch()` to
  `http://localhost:1234/v1/chat/completions` that returns text. If this round-trips from inside
  a Foundry session, the approach is viable. If mixed-content blocks it, resolve it here (reverse
  proxy, or serve LM Studio behind the same origin) before building anything else.

---

## Phase 1 — Module skeleton + state snapshot

### 1.1 Foundry Module Skeleton
- Create a FoundryVTT **client** module (`module.json`) with a proper manifest, targeting the
  Foundry V13 `compatibility` range.
- Register a custom command / hotkey that triggers "DM Mode".
- Read state **client-side** (in-session, no auth needed):
  - `game.scenes.current` / `canvas.tokens` — current scene, tokens, lighting
  - `game.actors` — active tokens, NPCs, stat blocks
  - `game.messages` — recent chat log (last N messages)
  - `game.journal` — journal entries linked to the scene
  - `game.packs` — compendium entries when needed

### 1.2 State Snapshot Format
Build a **selective, structured JSON snapshot** from the start (not a later optimization) — only
what the current turn needs, kept well under the model's context budget:
```json
{
  "scene": { "name": "Tavern Interior", "tokens": [...], "lighting": "dim" },
  "active_actors": [
    { "name": "Grom", "type": "PC", "hp": "28/45", "conditions": [], "position": {"x":0,"y":0} }
  ],
  "npcs": [
    { "name": "Borin Stonefist", "hp": "60/60", "dialogue_history": [] }
  ],
  "recent_chat": [],
  "journal_entries": []
}
```
Include the current scene, active tokens with HP/conditions, the last N chat lines, and only
journal entries linked/tagged to the scene.

### 1.3 Settings (not "API keys")
- Foundry core has **no API-key system**. Store module configuration (LM Studio URL, model id,
  temperature) via `game.settings.register` — **not** in `module.json`.
- No Foundry authentication is involved: the module already runs as the logged-in GM.

---

## Phase 2 — LLM narrative loop (MVP, narrative-only)

### 2.1 Local LLM Setup (Mac)
- **Inference server**: [LM Studio](https://lmstudio.ai) — OpenAI-compatible API at
  `http://localhost:1234/v1`, **CORS enabled** (see Phase 0).
- **Model**: Qwen3.6-35B-A3B (already running via LM Studio). "A3B" means ~3B **active
  parameters** per token out of ~35B total (MoE) — *not* "3 active experts". Strong
  instruction-following; good for roleplay/narrative.

### 2.2 Communication Protocol
- POST the snapshot + player message to `http://localhost:1234/v1/chat/completions`:
  ```json
  {
    "model": "qwen3.6-35b-a3b",
    "messages": [
      { "role": "system", "content": "You are a D&D 5e Dungeon Master focused on narrative..." },
      { "role": "user", "content": "<state snapshot JSON + player action>" }
    ],
    "temperature": 0.8,
    "max_tokens": 768
  }
  ```
- Cap `max_tokens` (~512–1024) to keep turn latency acceptable. Solo, turn-based play tolerates
  ~10–30s per turn, so latency is **not** a real risk — no need to drop to a smaller model.

### 2.3 Prompt Engineering
- System prompt: **narrative DM only, never mechanics** — "You describe scenes, NPC dialogue, and
  atmosphere. You NEVER roll dice, calculate damage, or apply game rules. Leave all mechanics to
  the game module."
- Include the structured context (scene, actors, recent chat, linked journal).
- Few-shot examples of good narrative responses.

### 2.4 Human-in-the-loop
- The MVP is narrative-only: **read scene + chat → LLM → GM approves/edits → post to Foundry
  chat**, with no mechanical automation. This vertical slice de-risks CORS, latency, and prompt
  quality before any rules work.

---

## Phase 3 — Structured intents over the dnd5e API

### 3.1 Structured output (not regex)
- Have the LLM emit structured actions via **tool-calling / JSON-schema output** (supported by
  LM Studio's OpenAI-compatible API), e.g.:
  ```json
  { "action": "attack", "source": "Goblin Archer", "target": "Grom" }
  ```
  Do **not** parse free-text prose with regex/substring — it misfires constantly.

### 3.2 Intent → dnd5e Pipeline
1. LLM emits intent JSON: `{ "action": "attack", "source": "Goblin Archer", "target": "Grom" }`.
2. Module resolves it through the **existing dnd5e system** — no custom rules engine:
   - attacks / saves / skills → `Actor#rollAttack()`, `rollSavingThrow()`, `rollSkill()`
   - damage / HP / conditions → dnd5e active effects and actor updates
3. Result posts to Foundry chat via native dnd5e roll cards; token HP/conditions update through
   the system.

### 3.3 Safety
- Intents are **validated suggestions the GM confirms**, never blind writes. This is also the
  guard against prompt injection via player-authored journal/chat text fed into the model.

---

## Phase 4 — Narrative Chat & UX

### 4.1 Chat Integration
- Module observes player roleplay messages, sends state + message to the LLM, receives narrative
  (and optional intents), GM approves, then it posts as a DM/NPC message and resolves any
  confirmed mechanical actions via dnd5e.

### 4.2 DM Mode Toggle
- A button in the Foundry UI toggles "DM Assist" mode.
- Off = untouched native Foundry play (no LLM interference).
- On = the module generates responses to player actions (GM-gated).

### 4.3 Manual Override
- `/dm-assist <message>` triggers a specific LLM response.
- GM can edit/correct the LLM's output before it's posted.

---

## Phase 5 — Polish & Testing

### 5.1 Testing
- Run a full solo scene and evaluate narrative quality/consistency, mechanical accuracy (rolls
  match dnd5e), and per-turn latency.

### 5.2 Improvements
- Diff-based snapshots (send only changed data), response caching.

### 5.3 Documentation
- Module install guide; LM Studio setup (incl. the **CORS/mixed-content fix** from Phase 0);
  troubleshooting.

---

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Integration | In-Foundry **client** module, JavaScript (Foundry V13 API) |
| Mechanics | **Reuse the `dnd5e` system API** (no custom engine) |
| Local LLM Server | LM Studio (OpenAI-compatible API at `localhost:1234`, **CORS enabled**) |
| LLM Model | Qwen3.6-35B-A3B (~3B active params, MoE — already running on this Mac) |
| LLM output | Tool-calling / JSON schema (not regex) |
| Communication | HTTP REST → LM Studio `/v1/chat/completions` |

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| CORS / mixed-content blocks browser → LM Studio calls | Resolve in Phase 0: enable CORS in LM Studio; serve Foundry same-origin/http or via reverse proxy. |
| LLM hallucinates mechanics | Narrative-only system prompt; all mechanics resolved by the dnd5e system, GM-confirmed. |
| Fragile intent parsing | Structured tool-calling / JSON-schema output, not regex. |
| Context overflow from large snapshots | Selective, scene-scoped snapshots from day one; diff-based later. |
| Prompt injection via player-authored journal/chat | Intents are GM-validated suggestions, never blind writes. |
| Foundry API changes | Pin module `compatibility` to Foundry version; test on update. |

## Next Steps (Immediate)
1. [ ] Phase 0 spike: confirm a Foundry GM session on the Mac can `fetch()` LM Studio at
   `http://localhost:1234` (fix CORS/mixed-content if not).
2. [ ] Verify LM Studio is running Qwen3.6-35B-A3B and note the API port (default 1234).
3. [ ] Build the client module skeleton (`module.json` + basic read functions).
4. [ ] Test reading a scene snapshot and sending it to LM Studio, returning narrative text.
