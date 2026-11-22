/**
 * A same-browser copy of in-progress text, written on every change. It lets a
 * reload show the draft at once instead of waiting on the server, and keeps
 * the text if a save request is lost. The server copy stays the source of
 * truth across devices: the newer of the two wins.
 */
export type LocalDraft = { text: string; at: number };

function key(paperId: string, fieldKey: string) {
  return `rw:draft:${paperId}:${fieldKey}`;
}

export function writeLocalDraft(paperId: string, fieldKey: string, text: string) {
  try {
    if (!text.trim()) {
      window.localStorage.removeItem(key(paperId, fieldKey));
      return;
    }
    window.localStorage.setItem(key(paperId, fieldKey), JSON.stringify({ text, at: Date.now() }));
  } catch {
    // Storage can be full or blocked; the server save still runs.
  }
}

export function readLocalDraft(paperId: string, fieldKey: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(key(paperId, fieldKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraft>;
    if (typeof parsed.text !== "string" || typeof parsed.at !== "number" || !parsed.text.trim()) return null;
    return { text: parsed.text, at: parsed.at };
  } catch {
    return null;
  }
}

export function clearLocalDraft(paperId: string, fieldKey: string) {
  try {
    window.localStorage.removeItem(key(paperId, fieldKey));
  } catch {
    // ignore
  }
}

/** Pick the newer of the local copy and the server draft. */
export function newerDraftText(
  local: LocalDraft | null,
  server: { text: string; updatedAt?: string | null } | null,
): string {
  const serverText = server?.text?.trim() ? server.text : "";
  if (!local) return serverText;
  if (!serverText) return local.text;
  const serverAt = server?.updatedAt ? Date.parse(server.updatedAt) : NaN;
  if (Number.isNaN(serverAt)) return local.text;
  return local.at >= serverAt ? local.text : serverText;
}
