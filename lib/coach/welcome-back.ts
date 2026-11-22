/**
 * The one line Pau Pau says when the student comes back to a conversation
 * that already has turns (Colton 3:46 PM). Varied, in her voice, one quip at
 * most, and never more than one per return: a reload within two minutes of
 * the last welcome adds nothing.
 */
export const WELCOME_BACK_LINES = [
  "Welcome back. Ready to pick up where we left off?",
  "Look who's back. Want to keep going from here?",
  "Welcome back. Your notes waited patiently. Ready to keep going?",
  "Hey, you're back. Pick up right where we stopped?",
  "Welcome back. Homework missed you, oddly. Want to keep going?",
] as const;

export const WELCOME_BACK_GAP_MS = 2 * 60 * 1000;

export type WelcomeState = { at: number; n: number };

export function parseWelcomeState(raw: string | null): WelcomeState | null {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<WelcomeState>) : null;
    return v && typeof v.at === "number" ? { at: v.at, n: typeof v.n === "number" ? v.n : 0 } : null;
  } catch {
    return null;
  }
}

/** The line to add on this return, or null (no history yet, or a rapid reload). */
export function welcomeBackLine(opts: { hasHistory: boolean; last: WelcomeState | null; now: number }): { line: string; next: WelcomeState } | null {
  if (!opts.hasHistory) return null;
  if (opts.last && opts.now - opts.last.at < WELCOME_BACK_GAP_MS) return null;
  const n = opts.last ? opts.last.n + 1 : 0;
  return { line: WELCOME_BACK_LINES[n % WELCOME_BACK_LINES.length]!, next: { at: opts.now, n } };
}
