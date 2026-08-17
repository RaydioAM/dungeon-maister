# Card 02 — State snapshot builder
**Phase:** 1  ·  **Depends on:** 01

## Goal
A function `buildSnapshot()` that reads the current Foundry game state and returns a
compact, selective JSON object describing the scene, active actors, NPCs, recent chat, and
scene-linked journal — ready to hand to the LLM in a later card.

## Context
Card 01 created the module (`src/module.js`, `src/settings.js`). This card adds a pure
read-only state reader. It does NOT call the LLM and does NOT write to chat — those are
cards 03/04. The system is dnd5e, so actor data (HP, conditions, type) comes from the
dnd5e data model. Keep the snapshot **selective and bounded** — this is the token budget
for every LLM turn, so do not dump entire journals or compendia.

## Files
Create:
- `src/snapshot.js` — exports `buildSnapshot()`.

Edit:
- `src/module.js` — import `buildSnapshot` and, on `ready`, log the result once for manual
  inspection (e.g. `console.log("[dungeon-maister] snapshot", buildSnapshot())`). This is
  temporary scaffolding so the snapshot can be eyeballed; a later card removes it.

## Spec
Export `buildSnapshot()` returning an object shaped like:
```js
{
  scene:   { name, darkness },            // current scene name + darkness/lighting level
  active_actors: [                        // player-character tokens on the current scene
    { name, type, hp: { value, max }, conditions: [/* status ids */], position: { x, y } }
  ],
  npcs: [                                 // non-PC tokens on the current scene
    { name, hp: { value, max } }
  ],
  recent_chat: [                          // last N chat messages, oldest→newest
    { speaker, text }                     // text = plain text, HTML stripped
  ],
  journal_entries: [                      // ONLY entries linked to the current scene's notes
    { name, text }                        // text = plain text, truncated to a sane length
  ]
}
```
Rules:
- Recent chat count `N` = 10 for now (a named `const` at the top of the file).
- Strip HTML from chat/journal text to plain text.
- Be defensive: if a field/actor/HP path is missing, use a sensible default (`null`, `0`,
  `[]`) and never throw. A partial snapshot is fine; a crash is not.
- Truncate each journal entry's text to ~1000 chars.

## Verify first
Confirm these against the installed Foundry V14 + dnd5e (use the searxng web tools /
`.goosehints` "Known-correct Foundry facts"; these are NOT pre-verified):
- Current scene: `game.scenes.current` vs `canvas.scene`; scene `darkness` property name.
- Tokens on the scene and reaching their actor: e.g. `canvas.tokens.placeables[].actor`
  or `scene.tokens` → `.actor`. Confirm token position fields (`x`/`y`).
- **dnd5e HP path** on an actor: likely `actor.system.attributes.hp.value` / `.max` —
  verify for the installed dnd5e version.
- PC vs NPC: `actor.type` values in dnd5e (e.g. `"character"` vs `"npc"`).
- Conditions/status effects on an actor: `actor.statuses` (a Set of status ids) vs
  iterating `actor.effects`. Pick the one that exists in V14.
- Chat: `game.messages.contents`, and how to get speaker name + message text
  (`message.content` is HTML; `message.speaker?.alias`).
- Scene-linked journal notes: `scene.notes` → each note's `entryId` → `game.journal.get(id)`.
  If scene-note linkage is unclear, fall back to an empty `journal_entries: []` and flag it.

## Acceptance criteria
- [ ] `buildSnapshot()` is exported from `src/snapshot.js` and callable.
- [ ] With a scene open in a dnd5e world, calling it from the browser console returns an
      object with all five top-level keys and does NOT throw.
- [ ] A player-character token on the scene appears in `active_actors` with correct
      `hp.value`/`hp.max`; non-PC tokens appear in `npcs`.
- [ ] `recent_chat` has at most 10 entries with plain-text `text` (no HTML tags).
- [ ] Any dnd5e/Foundry path that could not be verified is flagged with `// TODO: verify`.

## Do NOT
- Do not call the LLM or make any network request.
- Do not write to chat or modify any actor/token/scene.
- Do not include compendium data, full journals, or every chat message — keep it bounded.
- Do not create files other than `src/snapshot.js` (plus the temporary log line in module.js).

## Escalate to Claude
- If the dnd5e actor data model paths differ materially from the assumptions above
  (HP, type, conditions), report what the installed version actually uses.
- If scene→journal note linkage has no clear API, stop and raise it rather than guessing.
