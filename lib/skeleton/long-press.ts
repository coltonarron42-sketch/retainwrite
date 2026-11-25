// PC-30: press-and-hold on touch. A tap does nothing; holding ~350 ms lifts the section, and
// letting go opens it. Moving more than a few px (a scroll) or a pointercancel calls it off.
// Pure, so it's unit-tested; the component feeds it pointer events and a timer.

export const HOLD_MS = 350;
export const MOVE_TOLERANCE = 10;

export type PressState =
  | { phase: "idle" }
  | { phase: "pressing"; id: string; x: number; y: number; t: number }
  | { phase: "lifted"; id: string; x: number; y: number; t: number };

export type PressEvent =
  | { type: "down"; id: string; x: number; y: number; t: number }
  | { type: "tick"; t: number }
  | { type: "move"; x: number; y: number }
  | { type: "up"; t: number }
  | { type: "cancel" };

export type PressResult = { state: PressState; open: string | null };

export const IDLE: PressState = { phase: "idle" };

export function pressReduce(state: PressState, ev: PressEvent, opts: { holdMs?: number; tolerance?: number } = {}): PressResult {
  const holdMs = opts.holdMs ?? HOLD_MS;
  const tol = opts.tolerance ?? MOVE_TOLERANCE;
  switch (ev.type) {
    case "down":
      return { state: { phase: "pressing", id: ev.id, x: ev.x, y: ev.y, t: ev.t }, open: null };
    case "tick":
      if (state.phase === "pressing" && ev.t - state.t >= holdMs) return { state: { ...state, phase: "lifted" }, open: null };
      return { state, open: null };
    case "move":
      if (state.phase === "idle") return { state, open: null };
      if (Math.hypot(ev.x - state.x, ev.y - state.y) > tol) return { state: IDLE, open: null };
      return { state, open: null };
    case "up":
      if (state.phase === "lifted") return { state: IDLE, open: state.id };
      // Released before the hold finished: also lift-and-open if the hold time passed (timer late).
      if (state.phase === "pressing" && ev.t - state.t >= holdMs) return { state: IDLE, open: state.id };
      return { state: IDLE, open: null };
    case "cancel":
      return { state: IDLE, open: null };
  }
}
