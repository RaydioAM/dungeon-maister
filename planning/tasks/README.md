# Task Cards

Self-contained work units for the local LLM (Qwen via Goose) to execute **one at a
time**. Each card carries everything needed to do the job without prior conversation.
The persistent project context lives in [`.goosehints`](../../.goosehints) at the repo
root — Goose reads it automatically every session, so cards do NOT repeat the
architecture or constraints. Read `.goosehints` is assumed.

## How to run a card in Goose
1. Start Goose in the repo root (so it picks up `.goosehints`).
2. Tell it: *"Do the task in `planning/tasks/NN-name.md`. Follow `.goosehints`. Do only
   this card."*
3. Let it read the card, verify APIs, and write the files.
4. Check the card's **Acceptance criteria** and **Escalate to Claude** notes before
   moving to the next card.

## Escalation
If a card's work hits something the card marks **Escalate to Claude** — a design
decision, a tricky Foundry/dnd5e quirk, a non-obvious bug — stop and bring that specific
question back to Claude (Opus). Don't burn a long local debugging loop on it. Everything
else stays local.

## Card format
Every card uses this structure:

```
# Card NN — <short title>
**Phase:** <plan phase>  ·  **Depends on:** <card numbers or "none">

## Goal
One sentence: what exists after this card that didn't before.

## Context
Only what THIS card needs beyond .goosehints. Key file paths, prior card outputs.

## Files
Exact paths to create or edit.

## Spec
The concrete work: signatures, fields, behavior. Precise enough to remove guesswork.

## Verify first
APIs/fields to confirm against installed Foundry/dnd5e before writing code.

## Acceptance criteria
Checklist that proves the card is done (observable, not vibes).

## Do NOT
Scope fences — what to leave untouched.

## Escalate to Claude
Anything that should come back to Opus instead of being solved locally.
```

## Index (recommended order)
Phase 0 (CORS/mixed-content spike) is a manual environment check done by the human, not
a Qwen card — confirm a Foundry GM session on the Mac can `fetch()` LM Studio before
relying on card 02+.

| Card | Title | Phase | Depends on |
|------|-------|-------|-----------|
| 01 | Module skeleton + manifest | 1 | none |
| 02 | State snapshot builder | 1 | 01 |
| 03 | LM Studio client (fetch + settings) | 2 | 01 |
| 04 | Narrative loop, GM-approved (MVP) | 2 | 02, 03 |
| 05 | Structured intent schema + parser | 3 | 03 |
| 06 | dnd5e intent adapter | 3 | 05 |
| 07 | DM Assist toggle + `/dm-assist` command | 4 | 04 |
| 08 | Polish: diff snapshots, caching, docs | 5 | all |

Cards 02+ will be written after card 01 is validated in Goose, so the format can be
adjusted first. Only card 01 exists initially.
