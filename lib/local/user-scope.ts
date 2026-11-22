
/**
 * Every RetainWrite localStorage entry is scoped to the signed-in user, so two
 * accounts in one browser never see each other's settings or drafts:
 *   rw:u:<userId>:<name>
 * The app shell sets the user id before any page reads storage. Logging out
 * removes all RetainWrite entries from this browser.
 */
let currentUser: string | null = null;

export function setLocalUser(id: string | null) {
  currentUser = id;
}

export function localUser(): string {
  return currentUser ?? "anon";
}

export function scopedKey(name: string): string {
  return `rw:u:${localUser()}:${name}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read a scoped entry. A pre-scoping entry for the same paper (old key) is
 * moved over once: only the paper's owner can open that paper, so it is theirs.
 */
export function readScoped(name: string, legacyKey?: string): string | null {
  const s = storage();
  if (!s) return null;
  try {
    const v = s.getItem(scopedKey(name));
    if (v != null || !legacyKey) return v;
    const old = s.getItem(legacyKey);
    if (old != null) {
      s.setItem(scopedKey(name), old);
      s.removeItem(legacyKey);
    }
    return old;
  } catch {
    return null;
  }
}

export function writeScoped(name: string, value: string) {
  try {
    storage()?.setItem(scopedKey(name), value);
  } catch {
    /* full or blocked */
  }
}

export function removeScoped(name: string) {
  try {
    storage()?.removeItem(scopedKey(name));
  } catch {
    /* ignore */
  }
}

/** True for any key RetainWrite owns (new scoped keys and old unscoped ones). */
export function isAppKey(key: string): boolean {
  return /^rw[:_]/.test(key);
}

/** Remove every RetainWrite entry (all users) from this browser. Used on log out. */
export function clearAppLocalData() {
  for (const s of [storage(), (() => { try { return window.sessionStorage; } catch { return null; } })()]) {
    if (!s) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && isAppKey(k)) keys.push(k);
      }
      keys.forEach((k) => s.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}
