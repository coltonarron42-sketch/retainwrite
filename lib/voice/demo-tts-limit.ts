/**
 * Demo visitors get her voice too (QA 7:21 PM: demo must always have audio),
 * capped per demo session and network so the open demo can't run up the TTS
 * bill. Over the cap the browser voice (Web Speech) takes over.
 */
export const DEMO_TTS_LIMIT = 150;
export const DEMO_TTS_WINDOW_MS = 30 * 60 * 1000;
const demoUse = new Map<string, { since: number; n: number }>();
export function demoTtsAllowed(key: string, now = Date.now()): boolean {
  const cur = demoUse.get(key);
  if (!cur || now - cur.since > DEMO_TTS_WINDOW_MS) {
    demoUse.set(key, { since: now, n: 1 });
    if (demoUse.size > 5000) demoUse.delete(demoUse.keys().next().value!);
    return true;
  }
  cur.n += 1;
  return cur.n <= DEMO_TTS_LIMIT;
}
