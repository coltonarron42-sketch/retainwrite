/**
 * PC-31: a typed Pau answer the voice should speak (research turns run on the
 * text model with web search, then the voice says the result). The coach route
 * signs the exact words; the realtime relay speaks only words with a valid
 * signature for that paper, so the browser can't make her say anything else.
 * Server only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.PAU_REALTIME_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only";

export function signSpoken(paperId: string, text: string): string {
  return createHmac("sha256", secret()).update(`spoken|${paperId}|${text}`).digest("base64url");
}

export function verifySpoken(paperId: string, text: string, sig: string): boolean {
  if (!sig || !text) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(signSpoken(paperId, text));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** What the voice says for a typed answer: no Sources line, bullets as sentences, about 110 words at most. */
export function spokenFrom(paras: string[], maxWords = 110): string {
  const lines = paras.filter((p) => !/^Sources:/i.test(p)).map((p) => p.replace(/^•\s*/, "").trim()).filter(Boolean);
  const sents = lines.flatMap((l) => (/[.!?…]["”’)]*$/.test(l) ? [l] : [`${l}.`]));
  const out: string[] = [];
  let n = 0;
  for (const s of sents) {
    const w = s.split(/\s+/).length;
    if (n + w > maxWords && out.length) {
      // Keep her closing question even when the middle is trimmed.
      const last = sents[sents.length - 1]!;
      if (/\?["”’)]*$/.test(last) && !out.includes(last)) out.push("The rest is on screen.", last);
      break;
    }
    out.push(s);
    n += w;
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}
