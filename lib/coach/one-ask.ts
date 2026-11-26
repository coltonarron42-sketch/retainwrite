/**
 * PC-31: one next useful step per Pau turn. At the composition layer a reply
 * keeps at most ONE question (the last one she asked); any earlier question,
 * a stacked spark offer or an old style question is removed before it's shown
 * or spoken.
 * // SOP: coaching only, never generate submission text
 */

const Q_SENT = /[^.!?…\n]*\?+["”’)]*/g;

/** Question sentences in a text. */
export function questionsIn(text: string): string[] {
  return (text.match(Q_SENT) ?? []).map((q) => q.trim()).filter((q) => /[a-z]/i.test(q));
}

export function countAsks(paras: string[]): number {
  return paras.reduce((n, p) => n + questionsIn(p).length, 0);
}

/** Keep only the last question across the reply; drop items left empty. */
export function capOneAsk(paras: string[]): { paras: string[]; dropped: number } {
  const total = countAsks(paras);
  if (total <= 1) return { paras, dropped: 0 };
  let seen = 0;
  const out: string[] = [];
  for (const p of paras) {
    const kept = p
      .replace(Q_SENT, (q) => {
        if (!/[a-z]/i.test(q)) return q;
        seen++;
        return seen === total ? q : "";
      })
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s+([.,!])/g, "$1")
      .trim();
    if (kept && /[a-z0-9]/i.test(kept)) out.push(kept);
  }
  return { paras: out, dropped: total - 1 };
}
