import { registerSettings } from "./settings.js";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  console.log("[dungeon-maister] ready");
});
