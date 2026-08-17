# Card 01 — Module skeleton + manifest
**Phase:** 1  ·  **Depends on:** none

## Goal
A loadable FoundryVTT V14 module that registers its settings and logs a confirmation on
`ready`, so it appears in Foundry's Manage Modules list and can be enabled in a world.

## Context
This is the first code in the repo. There is no `src/` yet. The module id is
`dungeon-maister`. It depends on the `dnd5e` system (declared, used by later cards).
Config values (LM Studio URL, model id, temperature) are registered now via
`game.settings.register` even though nothing consumes them until card 03.

## Files
Create:
- `module.json` — the manifest, at repo root.
- `src/module.js` — the ES module entry point.
- `src/settings.js` — settings registration, imported by `module.js`.

## Spec
### `module.json`
A valid Foundry V14 module manifest for id `dungeon-maister`, including at minimum:
- `id`, `title`, `description`, `version` (`0.1.0`), `authors`.
- `compatibility` with a `minimum` and `verified` targeting **V14**.
- `esmodules` listing `src/module.js`.
- A `relationships.requires` (or the correct V14 field — **verify**) entry declaring a
  dependency on the `dnd5e` **system**.
- `url`/`manifest`/`download` may be placeholder strings.

### `src/settings.js`
Export a `registerSettings()` function that registers three world-scoped settings under
namespace `dungeon-maister`:
- `llmUrl` (String, default `"http://localhost:1234/v1"`)
- `modelId` (String, default `"qwen3.6-35b-a3b"`)
- `temperature` (Number, default `0.8`)
Each with a `name` and `hint`, `scope: "world"`, `config: true`.

### `src/module.js`
- `import { registerSettings } from "./settings.js";`
- On Foundry's `init` hook: call `registerSettings()`.
- On Foundry's `ready` hook: `console.log("[dungeon-maister] ready");`
- Use `Hooks.once(...)` for both.

## Verify first
Do NOT trust these from memory — confirm against the installed Foundry V14 before writing:
- The exact `module.json` field names for V14 (esp. `compatibility` shape and the
  `relationships`/`requires` structure for declaring a **system** dependency). Check
  https://foundryvtt.com/api/ or an existing installed module's `module.json`.
- The `game.settings.register(namespace, key, {...})` signature and valid option keys
  (`scope`, `config`, `type`, `default`) for V14.
- Correct hook names (`init`, `ready`) and `Hooks.once` usage in V14.

## Acceptance criteria
- [ ] `module.json` is valid JSON and parses; targets V14; declares the dnd5e system dependency.
- [ ] The module appears in Foundry's **Manage Modules** and can be enabled without error.
- [ ] With the module enabled and the world loaded, the browser console shows
      `[dungeon-maister] ready` and no errors from this module.
- [ ] The three settings appear under the module's settings in **Configure Settings**.
- [ ] Any manifest/API field that could not be verified is flagged with a `// TODO: verify`.

## Do NOT
- Do not add the LM Studio fetch, snapshot builder, chat integration, or any UI beyond
  settings — those are later cards.
- Do not add a bundler/build step; Foundry loads `src/*.js` directly as ES modules.
- Do not create files outside those listed above.

## Escalate to Claude
- If V14 requires a build/bundle step or a different source layout than plain `src/*.js`
  ES modules, stop and raise it — that changes the whole project structure.
- If the dnd5e system dependency cannot be declared as a hard requirement in the V14
  manifest, note how you worked around it and flag for review.
