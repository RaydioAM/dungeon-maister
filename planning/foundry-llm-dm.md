# FoundryVTT + Local LLM Dungeon Master — Project Plan

## Problem Statement

The user runs a FoundryVTT server at `10.0.40.10` (on a homelab mini-PC) hosting a D&D game.
The server has **no resources** to run a local LLM. The goal is to create a **local LLM Dungeon
Master** that runs on the user's Mac, reads the Foundry game state, and pushes the narrative
forward — acting as a co-DM for solo play.

### Constraints
- **Local LLM** runs on the Mac, **not** on the Foundry server.
- The Foundry server is read-only for game mechanics — the LLM must **not** hallucinate rules.
- The LLM should focus on **narrative** (dialogue, descriptions, NPC voices, plot).
- A FoundryVTT **module/plugin** bridges the two: it reads game state and relays it to the LLM.

---

## Architecture Overview

```
┌──────────────┐         WebSocket / HTTP          ┌──────────────────┐
│  FoundryVTT   │ ◄──────────────────────────────►  │  Local LLM (Mac)  │
│  Server       │   (Foundry Module + API calls)    │                   │
│  10.0.40.10   │                                   │  (Ollama /       │
│               │                                   │   LM Studio)      │
└──────────────┘                                   └──────────────────┘
       │                                                  │
       │  Read-only: tokens, maps, journals,              │  Generates narrative
       │  chat messages, NPCs, items                      │  responses
       ▼                                                  ▼
  Foundry API (authenticated)                    Local model (quantized GGUF)
```

### Key Design Principle: Separation of Concerns

| Layer | Responsibility |
|-------|---------------|
| **Foundry Module** | Read game state (tokens, maps, journal, chat, compendia). Write narrative text to chat. |
| **Local LLM** | Generate narrative: descriptions, NPC dialogue, plot hooks, weather, atmosphere. |
| **Rules Engine (hardcoded)** | Resolve all mechanics: attack rolls, saving throws, skill checks, damage, HP, spell effects. |

The LLM **never** rolls dice or applies rules. It outputs **intent** (e.g., "the dragon breathes fire
in a 60-ft cone") and the module translates that into Foundry actions + mechanical resolution.

---

## Phase 1: Discovery & State Reading (Week 1-2)

### 1.1 Foundry Module Skeleton
- Create a FoundryVTT module (`module.json`) with proper manifest.
- Register a custom command / hotkey that triggers "DM Mode".
- Use Foundry's **API** (not socket.io) for read access:
  - `game.scenes.current` — current scene, tokens, lighting
  - `game.journal` — journal entries, NPC notes, lore
  - `game.actors` — active tokens, NPCs, stat blocks
  - `game.chatMessages` — recent chat log (player + DM messages)
  - `game.packs` — compendium entries (monsters, spells, items)

### 1.2 State Snapshot Format
- Build a **structured JSON snapshot** of the game state:
  ```json
  {
    "scene": { "name": "Tavern Interior", "tokens": [...], "lighting": "dim" },
    "active_actors": [
      { "name": "Grom", "type": "PC", "hp": "28/45", "conditions": [], "position": {x,y} }
    ],
    "npcs": [
      { "name": "Borin Stonefist", "hp": "60/60", "dialogue_history": [...] }
    ],
    "recent_chat": [ ... ],
    "journal_entries": [ ... ],
    "active_effects": [ ... ]
  }
  ```

### 1.3 Authentication
- Foundry requires an **API key** (server settings → API Keys).
- Module stores the key in `module.json` settings (user-configurable).
- All API calls go through the Foundry server with proper auth headers.

---

## Phase 2: LLM Integration (Week 3-4)

### 2.1 Local LLM Setup (Mac)
- **Recommended**: [Ollama](https://ollama.com) — lightweight, local, supports GGUF models.
- **Model**: A 7B–13B parameter model fine-tuned for storytelling (e.g., `mistral`, `llama3-instruct`,
  or a D&D-specific fine-tune).
- Alternative: LM Studio for GUI-based local inference.

### 2.2 Communication Protocol
- Module sends state snapshots to the Mac via **local HTTP** (e.g., `localhost:8080/dm/snapshot`).
- LLM runs a lightweight **FastAPI** or **Express** endpoint on the Mac.
- Response returns structured JSON:
  ```json
  {
    "narrative": "The tavern falls silent as Borin steps forward, his axe gleaming...",
    "npc_dialogue": [
      { "speaker": "Borin", "text": "I've faced worse than goblins, lass." }
    ],
    "suggested_actions": ["search the barter counter", "ask about the missing merchant"],
    "atmosphere": "tense, dimly lit"
  }
```

### 2.3 Prompt Engineering
- System prompt defines the LLM's role: **narrative DM only, never mechanics**.
- Include structured context from the snapshot.
- Few-shot examples of good responses.

---

## Phase 3: Rules Engine (Week 5-6)

### 3.1 Hardcoded Rules
- D&D 5e mechanics implemented in JavaScript within the module:
  - Attack rolls: `d20 + modifier vs AC`
  - Saving throws, skill checks
  - Damage calculations (dice parsing: `2d6+3`)
  - Condition tracking (frightened, prone, grappled)
  - Spell effects (range, area, duration)

### 3.2 Intent → Action Pipeline
1. LLM outputs: "The goblin archer fires an arrow at Grom."
2. Module parses intent: `action: "attack"`, `target: "Grom"`, `source: "goblin archer"`.
3. Module resolves: look up goblin's attack bonus, roll d20, compare to Grom's AC.
4. Module outputs result to Foundry chat: "Goblin archer attacks Grom: 17 vs 15 AC — hit! 7 damage."
5. Module updates token HP and conditions.

### 3.3 Dice Rolling
- Option A: Use Foundry's built-in `Actor#rollTest()` for consistency with native dice.
- Option B: Module rolls its own dice (simpler, no dependency on Foundry's dice handler).

---

## Phase 4: Narrative Chat & User Interaction (Week 7-8)

### 4.1 Chat Integration
- Module intercepts chat messages from the player.
- When the player types a roleplay action, the module:
  1. Sends the current state + player message to the LLM.
  2. Receives narrative response.
  3. Posts the response to Foundry chat as a DM/NPC message.
  4. If mechanical actions are implied, resolves them via the rules engine.

### 4.2 DM Mode Toggle
- A button in the Foundry UI toggles "DM Assist" mode.
- When off: normal Foundry gameplay (no LLM interference).
- When on: the LLM auto-generates responses to player actions.

### 4.3 Manual Override
- Player can type `/dm-assist <message>` to trigger a specific LLM response.
- Player can edit/correct the LLM's output before it's posted.

---

## Phase 5: Polish & Testing (Week 9-10)

### 5.1 Testing
- Run a full session with the LLM DM and evaluate:
  - Narrative quality (is it engaging? consistent?)
  - Mechanical accuracy (do all rolls resolve correctly?)
  - Latency (is response time acceptable? ~5-15s for local LLM).

### 5.2 Improvements
- Optimize state snapshots (send only changed data).
- Add caching for repeated responses.
- Support multiple LLM backends (Ollama, LM Studio, local Python server).

### 5.3 Documentation
- Module install guide.
- LLM setup guide (Ollama model recommendations).
- Troubleshooting (network connectivity, API key setup).

---

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Foundry Module | JavaScript (Foundry V12/V13 API) |
| Local LLM Server | Ollama (preferred) or LM Studio |
| LLM Models | Mistral 7B, Llama 3 8B, or D&D fine-tune (GGUF, quantized) |
| Communication | HTTP REST (localhost) |
| Game Rules | JavaScript (hardcoded D&D 5e) |

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| LLM latency too high for live play | Use smaller models (7B), quantize to Q4_K_M, pre-warm model. |
| LLM hallucinates mechanics | Strict system prompt + rules engine always resolves dice. |
| Foundry API changes | Pin module to Foundry version; test on update. |
| Network issues (Mac ↔ Foundry server) | Fallback to manual copy-paste of state snapshots. |

## Next Steps (Immediate)
1. [ ] Get Foundry API key from server settings at `10.0.40.10:30000`.
2. [ ] Install Ollama on the Mac and pull a story-friendly model.
3. [ ] Build the FoundryVTT module skeleton (`module.json` + basic read functions).
4. [ ] Test reading a scene snapshot and sending it to a local LLM endpoint.
