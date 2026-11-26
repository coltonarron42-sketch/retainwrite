import { wordCount } from "@/lib/utils";

export type VoiceAnswer = {
  text: string;
  isVoiceSample: boolean;
  kind?: string;
  pasteRatio?: number;
};

export function collectVoiceSampleText(answers: VoiceAnswer[]): string {
  return answers
    .filter((a) => a.isVoiceSample)
    .map((a) => a.text.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Weighted sample for baseline metrics: typed answers count more than pasted.
 * Invisible to the student; never blocks.
 */
export function collectWeightedVoiceSample(answers: VoiceAnswer[]): string {
  const parts: string[] = [];
  for (const a of answers.filter((x) => x.isVoiceSample && x.text.trim())) {
    const ratio = a.pasteRatio ?? 0;
    if (ratio > 0.6) {
      // keep once (pasted-heavy)
      parts.push(a.text.trim());
    } else {
      // typed-heavy: include twice so metrics lean on natural typing
      parts.push(a.text.trim(), a.text.trim());
    }
  }
  return parts.join("\n");
}

export type CountedVoiceRow = {
  questionId: string;
  text: string;
  isVoiceSample: boolean;
};

/** One count per question. Duplicate saves and a story blurb are not added again. */
export function tallyVoiceWords(rows: CountedVoiceRow[]): number {
  const latest = new Map<string, string>();
  for (const row of rows) {
    if (!row.isVoiceSample) continue;
    const text = row.text.trim();
    if (!text) continue;
    latest.set(row.questionId, text);
  }
  let total = 0;
  for (const text of latest.values()) total += wordCount(text);
  return total;
}

// PC-32 (Colton t219u, Nov 25, 2026): there is no Stage 1 voice minimum, readiness line or
// extra voice question any more. Voice is captured in the background from every answer in every
// stage (lib/style/voice-capture.ts, lib/server/voice/capture.ts).
