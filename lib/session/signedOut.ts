/**
 * Set the moment the student taps Log out (QA 12:25 #3). Autosave, pagehide
 * flushes and background checks read it and stop, so nothing fires a 401
 * after the session is gone. Cleared when a signed-in page renders again.
 */
type Listener = () => void;

let out = false;
const listeners = new Set<Listener>();

export function signedOut(): boolean {
  return out;
}

export function markSignedOut() {
  if (out) return;
  out = true;
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // A listener failing must not stop the others.
    }
  }
}

export function clearSignedOut() {
  out = false;
}

/** Run `fn` on logout (e.g. clear timers). Returns an unsubscribe. */
export function onSignedOut(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
