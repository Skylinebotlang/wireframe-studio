// ─────────────────────────────────────────────────────────────────────────────
// LAUNCH SITE MESSAGE BUS — how the parts of the landing page talk to the
// 3D AI character without importing each other.
//
//   • tellAgent({...})   the loader and the hero tell the character what to do
//                        (draw itself in, become solid, wave, draw, look at a
//                        spot on screen). The character (app/launch/agent3d.ts)
//                        listens for these.
//   • The last "progress" and "solid" messages are remembered, so a character
//     that finishes loading late still catches up.
//   • "ls:loaded" fires once when the loader has handed off to the hero.
// Nothing here draws anything.
// ─────────────────────────────────────────────────────────────────────────────

export type AgentCommand =
  | { type: "progress"; p: number } // 0..1: how much of the character is drawn in
  | { type: "solid" } // outline → solid, glowing figure
  | { type: "wave" } // a small hello
  | { type: "draw"; on: boolean } // pen hand busy drawing (or not)
  | { type: "look"; x: number; y: number; ms?: number } // look at a screen point for a while
  | { type: "mood"; mood: "idle" | "focus" }; // focus = leans in, eyes narrow a little

type AgentMemory = { progress: number; solid: boolean };

declare global {
  interface Window {
    __lsAgent?: AgentMemory;
    __lsLoaded?: boolean;
  }
}

export const AGENT_EVENT = "ls:agent";
export const LOADED_EVENT = "ls:loaded";
export const AGENT_READY_EVENT = "ls:agent-ready";

export function agentMemory(): AgentMemory {
  if (!window.__lsAgent) window.__lsAgent = { progress: 0, solid: false };
  return window.__lsAgent;
}

export function tellAgent(cmd: AgentCommand) {
  if (typeof window === "undefined") return;
  const mem = agentMemory();
  if (cmd.type === "progress") mem.progress = cmd.p;
  if (cmd.type === "solid") mem.solid = true;
  window.dispatchEvent(new CustomEvent<AgentCommand>(AGENT_EVENT, { detail: cmd }));
}

// Call `fn` once the loader is done (right away if it already is).
export function onLoaded(fn: () => void): () => void {
  if (window.__lsLoaded) {
    fn();
    return () => {};
  }
  addEventListener(LOADED_EVENT, fn, { once: true });
  return () => removeEventListener(LOADED_EVENT, fn);
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
