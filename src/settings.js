/**
 * Register all dungeon-maister settings with game.settings.
 * Called during the init hook.
 */
export function registerSettings() {
  game.settings.register("dungeon-maister", "llmUrl", {
    name: "LLM API URL",
    hint: "Base URL for the local LLM server (e.g. LM Studio).",
    scope: "world",
    config: true,
    type: String,
    default: "http://localhost:1234/v1"
  });

  game.settings.register("dungeon-maister", "modelId", {
    name: "Model ID",
    hint: "The model identifier to use with the LLM API.",
    scope: "world",
    config: true,
    type: String,
    default: "qwen3.6-35b-a3b"
  });

  game.settings.register("dungeon-maister", "temperature", {
    name: "Temperature",
    hint: "Sampling temperature for the LLM (0–2). Higher = more creative.",
    scope: "world",
    config: true,
    type: Number,
    default: 0.8
  });
}
