// SOP: coaching only, never generate submission text
// H3: block hidden-draft n-grams that are not already in the student's own text.

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function grams(text: string, size: number): Set<string> {
  const parts = tokens(text);
  const out = new Set<string>();
  for (let i = 0; i <= parts.length - size; i += 1) out.add(parts.slice(i, i + size).join(" "));
  return out;
}

export function assertNoHiddenDraftLeak(
  output: string,
  hiddenDraft: string,
  studentCorpus: string,
  canary?: string,
): { ok: true } | { ok: false; rule: "ngram" | "near" | "canary" } {
  if (!hiddenDraft.trim()) return { ok: true };
  if (canary && output.includes(canary)) return { ok: false, rule: "canary" };
  const student = grams(studentCorpus, 5);
  for (const gram of grams(hiddenDraft, 5)) {
    if (grams(output, 5).has(gram) && !student.has(gram)) return { ok: false, rule: "ngram" };
  }
  const hiddenSentences = hiddenDraft.split(/(?<=[.!?])\s+/);
  for (const sentence of output.split(/(?<=[.!?])\s+/)) {
    const novel = tokens(sentence).filter((token) => !tokens(studentCorpus).includes(token));
    if (novel.length < 4) continue;
    for (const hidden of hiddenSentences) {
      const hiddenTokens = new Set(tokens(hidden));
      const hit = novel.filter((token) => hiddenTokens.has(token)).length / novel.length;
      if (hit >= 0.5) return { ok: false, rule: "near" };
    }
  }
  return { ok: true };
}
