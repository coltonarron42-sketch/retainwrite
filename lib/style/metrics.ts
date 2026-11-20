import { STOPWORDS } from "./stopwords";

export type StyleMetrics = {
  wordCount: number;
  avgSentenceLength: number;
  readingGrade: number;
  formality: "casual" | "neutral" | "formal";
  formalityScore: number;
  topContentWords: { word: string; count: number }[];
  vocabulary: string[];
};

const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|Prof|Jr|Sr|vs|etc|e\.g|i\.e)\./gi;
const SLANG = new Set([
  "like",
  "gonna",
  "kinda",
  "lol",
  "stuff",
  "things",
  "really",
  "super",
]);
const FORMAL_CONNECTORS = new Set([
  "however",
  "therefore",
  "moreover",
  "furthermore",
  "consequently",
]);
const PERSON_PRONOUNS = new Set([
  "i",
  "me",
  "my",
  "mine",
  "we",
  "us",
  "our",
  "ours",
  "you",
  "your",
  "yours",
]);

export function splitSentences(text: string): string[] {
  const normalized = text.replace(ABBREV, (m) => m.replace(/\./g, ""));
  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z']+/g)
    ?.map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean) ?? [];
}

export function contentWords(text: string): string[] {
  return tokenizeWords(text).filter((w) => !STOPWORDS.has(w) && w.length > 1);
}

export function computeStyleMetrics(text: string): StyleMetrics {
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = words.length;
  const avgSentenceLength = wordCount / sentenceCount;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const readingGrade =
    0.39 * (wordCount / sentenceCount) +
    11.8 * (syllables / Math.max(1, wordCount)) -
    15.59;

  const content = contentWords(text);
  const freq = new Map<string, number>();
  for (const w of content) freq.set(w, (freq.get(w) ?? 0) + 1);
  const topContentWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  let formalityScore = 0.5;
  const contractions = (text.match(/\b\w+'\w+\b/g) ?? []).length;
  formalityScore -= Math.min(0.25, contractions / Math.max(1, wordCount) * 4);
  const personRate =
    words.filter((w) => PERSON_PRONOUNS.has(w)).length / Math.max(1, wordCount);
  formalityScore -= Math.min(0.2, personRate * 2);
  const slangRate =
    words.filter((w) => SLANG.has(w)).length / Math.max(1, wordCount);
  formalityScore -= Math.min(0.2, slangRate * 5);
  formalityScore -= Math.min(0.1, (text.match(/!/g) ?? []).length * 0.03);
  const avgWordLen =
    words.reduce((s, w) => s + w.length, 0) / Math.max(1, wordCount);
  if (avgWordLen > 5) formalityScore += Math.min(0.15, (avgWordLen - 5) * 0.05);
  const passiveHits = (text.match(/\b(?:is|are|was|were|be|been|being)\s+\w+ed\b/gi) ?? [])
    .length;
  formalityScore += Math.min(0.1, passiveHits * 0.02);
  const connectorHits = words.filter((w) => FORMAL_CONNECTORS.has(w)).length;
  formalityScore += Math.min(0.15, connectorHits * 0.03);
  formalityScore = Math.max(0, Math.min(1, formalityScore));

  const formality: StyleMetrics["formality"] =
    formalityScore < 0.4
      ? "casual"
      : formalityScore <= 0.65
        ? "neutral"
        : "formal";

  return {
    wordCount,
    avgSentenceLength: Number(avgSentenceLength.toFixed(2)),
    readingGrade: Number(readingGrade.toFixed(2)),
    formality,
    formalityScore: Number(formalityScore.toFixed(3)),
    topContentWords,
    vocabulary: [...new Set(content)],
  };
}
