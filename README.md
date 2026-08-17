# dungeon-maister

A FoundryVTT client module that turns a local LLM into a **narrative co-DM** for solo D&D 5e play.

## What it does

This module runs inside the GM's browser session in FoundryVTT. It reads the current game state
(scenes, tokens, actors, chat) and sends a compact snapshot to a local LLM running via [LM Studio](https://lmstudio.ai).
The LLM generates narrative descriptions, NPC dialogue, and plot hooks — then posts the result back
to Foundry's chat.

**Mechanics (dice, HP, conditions) are resolved by Foundry's `dnd5e` system — never by the LLM.**

## Architecture

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
```

- The module is a **client-side** FoundryVTT module — no external server, no API keys.
- The LLM runs locally on the GM's Mac via LM Studio.
- The LLM communicates over LM Studio's OpenAI-compatible API at `http://localhost:1234/v1`.

## Current setup

| Component | Technology |
|-----------|-----------|
| FoundryVTT server | Running on homelab (10.0.40.10:30000) |
| LLM server | LM Studio (OpenAI-compatible API at `localhost:1234`) |
| LLM model | Qwen 3.6 35B A3B (~3B active parameters, MoE) |
| Game system | `dnd5e` (mechanics handled by the system, not the module) |

## Key design principles

1. **LLM does narrative only** — never rolls dice, calculates damage, or applies rules.
2. **Structured output** — the LLM emits intents via tool-calling / JSON schema, never regex-parsed prose.
3. **Human-in-the-loop** — all mechanical actions are GM-confirmed suggestions, never blind writes.
4. **Reuse `dnd5e`** — attack rolls, saves, damage, HP, conditions all go through the system's own API.
5. **Configuration via `game.settings.register`** — no hardcoded values in the manifest.

## Planned roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| 0. De-risk spike | Confirm CORS / mixed-content works between Foundry and LM Studio | ✅ Complete |
| 1. Module skeleton | `module.json`, settings registration, `ready` hook | ⏳ Next |
| 2. LLM narrative loop | Read state → send to LM Studio → post narrative to chat | ⏳ Planned |
| 3. Structured intents | LLM emits action JSON → module resolves via dnd5e system | ⏳ Planned |
| 4. Chat integration | DM mode toggle, chat observation, manual override | ⏳ Planned |
| 5. Polish & testing | Full solo scene, latency optimization, docs | ⏳ Planned |

## Requirements

- FoundryVTT V14 (GM session)
- The `dnd5e` system installed
- LM Studio running locally with a model loaded
- CORS enabled in LM Studio (Developer settings → "Serve on local network")

## Getting started (once the module is built)

1. Install the module into your FoundryVTT world.
2. Enable it in **Manage Modules**.
3. Configure the LM Studio URL, model ID, and temperature in the module settings.
4. Toggle **DM Assist** mode in the Foundry UI.
5. Play — the module will generate narrative responses to your actions.

## License

[To be determined]
