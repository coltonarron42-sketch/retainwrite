/**
 * QA 6:35 #2/#3: the background fallback without a second model call. For mainstream leadership styles,
 * at most 2 widely documented examples (a named leader, the organization, what they did), with no
 * numbers, dates, quotes or sites. Each is covered widely in business press and leadership textbooks;
 * the label "From general background (check before citing):" goes on them (R2: nothing invented).
 * A style that isn't here gets no list from this table (the route may ask the model, with a short cap).
 */
import { STYLE_WORDS, setAsideStyles } from "@/lib/stage1/style-negation";

export const KNOWN_EXAMPLES: Record<string, string[]> = {
  servant: [
    "• Herb Kelleher at Southwest Airlines put employees first, on the view that well-treated staff take care of customers.",
    "• Cheryl Bachelder at Popeyes turned the chain around by treating its franchisees as the customers she served.",
  ],
  transformational: [
    "• Satya Nadella at Microsoft reshaped the company's culture around a growth mindset and collaboration.",
    "• Lou Gerstner at IBM pulled the company back from crisis by refocusing it on customers and services.",
  ],
  transactional: ["• Jack Welch at General Electric tied rewards and promotions closely to ranked performance."],
  situational: ["• Alex Ferguson at Manchester United adjusted how he handled each player to fit their needs and experience."],
  democratic: ["• Ricardo Semler at Semco gave employees a real say in company decisions, including setting their own hours."],
  participative: ["• Ricardo Semler at Semco gave employees a real say in company decisions, including setting their own hours."],
  autocratic: ["• Steve Jobs at Apple kept tight personal control over product decisions and design."],
  authoritarian: ["• Steve Jobs at Apple kept tight personal control over product decisions and design."],
  "laissez-faire": ["• Warren Buffett at Berkshire Hathaway leaves the managers of the companies it owns largely free to run them."],
  authentic: ["• Bill George at Medtronic led by his own values and later wrote the book that named authentic leadership."],
  charismatic: ["• Steve Jobs at Apple rallied employees and customers around his vision through his presence and product launches."],
};

/** The style an ask is about: one it names (and doesn't set aside), else the paper's chosen style. */
export function askedStyle(message: string, fallbacks: (string | null | undefined)[] = []): string | null {
  const aside = new Set(setAsideStyles(message));
  const lower = message.toLowerCase();
  const named = STYLE_WORDS.find((w) => !aside.has(w) && new RegExp(`\\b${w}\\b`).test(lower));
  if (named) return named;
  for (const f of fallbacks) {
    const l = (f ?? "").toLowerCase();
    const hit = STYLE_WORDS.find((w) => !aside.has(w) && new RegExp(`\\b${w}\\b`).test(l));
    if (hit) return hit;
  }
  return null;
}

/** Up to 2 widely documented examples for that style ([] when it isn't a mainstream style here). */
export function knownExamplesFor(style: string | null): string[] {
  return style ? (KNOWN_EXAMPLES[style] ?? []).slice(0, 2) : [];
}

const isAsk = (s: string) => /\?["”'’)]*\s*$/.test(s.trim());
const LIST_ASK = /\b(?:these|those|any of (?:them|the)|which one|one of them)\b/i;

/**
 * QA 6:35 #5: the closer matches the count. One example: "Does this fit your Sam Walton angle?";
 * several: "Which of these fits your Sam Walton angle best?". With none, a question that implies a
 * list is dropped (her other question stays).
 */
export function researchCloser(paras: string[], leader?: string | null): string[] {
  const n = paras.filter((p) => /^\s*[•*-]\s+\S/.test(p)).length;
  const who = (leader ?? "").replace(/\s+/g, " ").trim();
  const angle = who && who.length <= 40 && !/[?.!]/.test(who) ? `your ${who} angle` : null;
  // Trailing questions (whole paragraphs, or the last sentences of the last paragraph) go.
  const out = [...paras];
  while (out.length) {
    const last = out[out.length - 1]!;
    if (/^\s*[•*-]\s/.test(last) || /^Sources?:/i.test(last)) break;
    if (n === 0 && !LIST_ASK.test(last)) break;
    if (isAsk(last)) {
      const kept = last.replace(/(?:^|(?<=[.!]\s))[^.!?]*\?["”'’)]*\s*$/, "").trim();
      if (kept && kept !== last.trim()) out[out.length - 1] = kept;
      else out.pop();
      continue;
    }
    break;
  }
  if (n === 1) out.push(`Does this fit ${angle ?? "what you're arguing"}?`);
  else if (n >= 2) out.push(`Which of these fits ${angle ?? "your paper"} best?`);
  return out;
}
