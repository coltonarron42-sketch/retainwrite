/**
 * Client helper for listening paraphrases and claims. The model is the
 * intended path; a 3.5s/5s window was too tight and forced the fallback.
 * Deterministic fallbacks still win if the model fails, times out, or is messy.
 */
import {
  exploreReply,
  listeningClaim,
  parseListenModelClaim,
  parseListenModelReply,
} from "@/lib/stages/explore-intent";

const LISTEN_CLIENT_MS = 11_000;

async function postListen(
  paperId: string,
  body: { mode: "reflect" | "claim"; message?: string; notes?: string[]; section: string },
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LISTEN_CLIENT_MS);
  try {
    const res = await fetch(`/api/papers/${paperId}/stance/listen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: string; claim?: string };
    return (data.reply ?? data.claim ?? "").trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchListenReply(paperId: string, text: string, sectionTitle: string): Promise<string> {
  const fallback = exploreReply(text, sectionTitle);
  const model = await postListen(paperId, { mode: "reflect", message: text.slice(0, 4000), section: sectionTitle });
  return model ? parseListenModelReply(model, fallback) : fallback;
}

export async function fetchListenClaim(paperId: string, notes: string[], sectionTitle: string): Promise<string | null> {
  const fallback = listeningClaim(notes, sectionTitle);
  const model = await postListen(paperId, { mode: "claim", notes: notes.map((n) => n.slice(0, 500)).slice(0, 12), section: sectionTitle });
  return model ? parseListenModelClaim(model, fallback) : fallback;
}
