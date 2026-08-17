# Card 03 — LM Studio client
**Phase:** 2  ·  **Depends on:** 01

## Goal
An async function `callLLM({ system, user })` that sends a chat request to the local
LM Studio server (using the module's registered settings) and returns the assistant's
text response, with clear error handling.

## Context
Card 01 registered the settings `llmUrl` (default `http://localhost:1234/v1`), `modelId`
(default `qwen3.6-35b-a3b`), and `temperature` (default `0.8`) under the `dungeon-maister`
namespace. This card is the transport layer only: it builds an OpenAI-compatible request
and parses the response. It does NOT read Foundry state (card 02) and does NOT post to chat
(card 04). This is a browser `fetch` from the Foundry client to `localhost:1234`; assume
CORS is enabled in LM Studio (a Phase 0 concern) — do not add proxy workarounds here.

## Files
Create:
- `src/llm.js` — exports `async function callLLM({ system, user })`.

Edit (temporary scaffolding, removed by a later card):
- `src/module.js` — expose the function for manual console testing, e.g.
  `game.modules.get("dungeon-maister").api = { callLLM };` set on `ready` (verify the
  correct V14 way to attach a module API). Do NOT auto-call it on load.

## Spec
`callLLM({ system, user })`:
- Read settings via `game.settings.get("dungeon-maister", "llmUrl" | "modelId" | "temperature")`.
- Endpoint = `llmUrl` joined with `chat/completions` (handle a trailing slash on `llmUrl`;
  default resolves to `http://localhost:1234/v1/chat/completions`).
- POST JSON body:
  ```js
  {
    model: <modelId>,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: <temperature>,
    max_tokens: 768
  }
  ```
  `max_tokens` = 768 as a named `const` at the top of the file.
- `Content-Type: application/json`.
- On HTTP non-2xx: throw an `Error` including the status and any response body text, AND
  surface it with `ui.notifications.error(...)` (verify this exists in V14).
- On success: parse and return `data.choices[0].message.content` (a string). If the shape is
  unexpected/empty, throw a clear error rather than returning `undefined`.
- Wrap network failures (server down) in a clear error message mentioning the URL — this is
  the most likely failure (LM Studio not running / CORS blocked).

## Verify first
- The OpenAI-compatible chat-completions request and response shape for LM Studio
  (`/v1/chat/completions`, `choices[0].message.content`). Low risk but confirm via LM Studio
  docs using the searxng web tools.
- The V14 way to attach a public API to a module object (`game.modules.get(id).api = ...`)
  and that `ui.notifications.error` exists.
- That the browser global `fetch` is available in the Foundry client context (it is).

## Acceptance criteria
- [ ] `callLLM` is exported and, with the temporary scaffolding, reachable from the console
      (e.g. `await game.modules.get("dungeon-maister").api.callLLM({ system: "You are terse.", user: "Say hi in three words." })`).
- [ ] With LM Studio running, that call returns a non-empty string.
- [ ] With LM Studio stopped, the call throws/notifies a clear error naming the URL — it does
      NOT hang silently or return `undefined`.
- [ ] The request uses the settings values, not hardcoded URL/model/temperature.
- [ ] Anything unverifiable is flagged with `// TODO: verify`.

## Do NOT
- Do not read Foundry game state or import `snapshot.js` — this is transport only.
- Do not post to chat or mutate any document.
- Do not add streaming, retries, or tool-calling yet (tool-calling is card 05).
- Do not add a proxy/CORS workaround; if CORS blocks the request, escalate.

## Escalate to Claude
- If the browser `fetch` to `http://localhost:1234` is blocked by CORS/mixed-content, stop
  and report it — that is the Phase 0 environment issue, not something to code around here.
- If LM Studio's response shape differs from the standard OpenAI format, report the actual
  shape.
