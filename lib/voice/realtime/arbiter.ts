"use client";

/**
 * PC-29: one input channel at a time. The composer reports focus, keystrokes
 * and whether its box has text; a page can flag a typed-answer prompt. The
 * voice client asks `isTyping()` on every mic frame and sends silence while
 * the student types, so talking-while-typing never interrupts her or starts a
 * second, competing reply. Module-level so the composer and the call don't
 * need to share props (there is one call per tab).
 */
import { typingActive, TURN_TUNING } from "./turns";

type State = { focused: boolean; lastKeyAt: number; hasText: boolean; typedPrompt: boolean };
const s: State = { focused: false, lastKeyAt: 0, hasText: false, typedPrompt: false };
const subs = new Set<(typing: boolean) => void>();
let last = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

function emit() {
  const t = typingActive(s, now());
  if (timer) clearTimeout(timer);
  timer = null;
  // Re-check when the keystroke window lapses (no text, still focused).
  if (t && s.focused && !s.hasText && !s.typedPrompt) timer = setTimeout(emit, TURN_TUNING.typingIdleMs + 20);
  if (t === last) return;
  last = t;
  for (const f of subs) f(t);
}

export const typingArbiter = {
  focus(hasText: boolean) {
    s.focused = true;
    s.hasText = hasText;
    emit();
  },
  blur() {
    s.focused = false;
    emit();
  },
  key(hasText: boolean) {
    s.lastKeyAt = now();
    s.hasText = hasText;
    emit();
  },
  /** The box was sent or cleared. */
  sent() {
    s.hasText = false;
    s.lastKeyAt = 0;
    emit();
  },
  setTypedPrompt(on: boolean) {
    s.typedPrompt = on;
    emit();
  },
  isTyping(): boolean {
    return typingActive(s, now());
  },
  subscribe(f: (typing: boolean) => void): () => void {
    subs.add(f);
    return () => void subs.delete(f);
  },
  /** Tests only. */
  _reset() {
    Object.assign(s, { focused: false, lastKeyAt: 0, hasText: false, typedPrompt: false });
    last = false;
  },
};
