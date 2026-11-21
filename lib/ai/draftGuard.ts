// SOP: coaching only, never generate submission text

import { GENERIC_WORDS } from "@/lib/ai/genericWords";

export type DraftGuardInput = {
  text: string;
  topicStems: string[];
  studentText: string;
  quotedOk?: boolean;
};

const REWRITE = [
  "something like",
  "you might write",
  "try saying",
  "one way to put it",
  "your intro could read",
  "here's a version",
  "consider phrasing",
  "a stronger sentence would be",
  "your thesis could be",
  "your so what could be",
  "you could say",
];

function stems(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !GENERIC_WORDS.has(word));
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function draftGuard(input: DraftGuardInput): { ok: true } | { ok: false; rule: string } {
  const text = input.text.trim();
  const lower = text.toLowerCase();
  if (/\[|___|\[your\b/i.test(text) || /we started with|it started with/i.test(lower)) {
    return { ok: false, rule: "D6" };
  }
  if (REWRITE.some((phrase) => lower.includes(phrase))) return { ok: false, rule: "D4" };

  const quotes = [...text.matchAll(/"([^"]+)"|'([^']+)'|“([^”]+)”/g)].map(
    (match) => match[1] || match[2] || match[3] || "",
  );
  for (const quote of quotes) {
    const words = quote.trim().split(/\s+/).filter(Boolean);
    if (words.length > 8) return { ok: false, rule: "D2" };
    if (!input.studentText.toLowerCase().includes(quote.toLowerCase())) return { ok: false, rule: "D2" };
  }

  const topic = new Set(input.topicStems.map((stem) => stem.toLowerCase()));
  const studentStems = new Set(stems(input.studentText));
  for (const sentence of sentences(text)) {
    const isQuestion = sentence.trim().endsWith("?");
    const bare = sentence.replace(/"[^"]+"/g, "").replace(/“[^”]+”/g, "");
    const used = stems(bare).filter((stem) => topic.has(stem) || input.topicStems.some((topicStem) => stem.includes(topicStem.toLowerCase())));
    if (!isQuestion && used.length && /[.!]$/.test(sentence.trim())) {
      return { ok: false, rule: "D1" };
    }
    if (isQuestion) {
      const unknown = used.filter((stem) => !studentStems.has(stem) && !input.studentText.toLowerCase().includes(stem));
      if (unknown.length && stems(bare).length >= 6) return { ok: false, rule: "D3" };
    }
    if (!sentence.includes('"') && !sentence.includes("“")) {
      for (const studentSentence of sentences(input.studentText)) {
        const shared = stems(sentence).filter((stem) => stems(studentSentence).includes(stem));
        if (shared.length >= 3) return { ok: false, rule: "D5" };
      }
    }
  }
  return { ok: true };
}
