/**
 * OCR / vision fallback order for images and scanned PDF pages.
 * // SOP: coaching only, never generate submission text
 *
 * 1. Mistral OCR when MISTRAL_OCR_API_KEY is set
 * 2. Grok vision (MODEL_STRONG) when Mistral is missing, fails, or confidence < 0.5
 * 3. Mark page failed and surface retake UI
 */

import type OpenAI from "openai";
import { assertCoachingOnly } from "@/lib/ai/guard";
import { getGrokClient } from "@/lib/ai/grok";
import { MODEL_FAST, MODEL_STRONG } from "@/lib/config";

const VISION_TIMEOUT_MS = 30_000;
const VISION_PROMPT =
  "This is a photo or scan of a student's assignment sheet. Transcribe all readable text exactly as written, " +
  "keeping line breaks, labels, lists and point values. Write tables as plain lines, one row per line (no Markdown). Include handwriting if readable. Do not summarize, explain, " +
  "or add anything. The photo may be sideways or upside down: read it in its correct orientation and transcribe the whole page, " +
  "top to bottom, including lines cut off at the edges. Output only the transcription. If there is no readable text, output exactly NO_TEXT.";

export type OcrPageResult = {
  text: string;
  method: "ocr_mistral" | "ocr_grok_vision" | "failed";
  confidence: number;
  quality: "good" | "blurry" | "dark" | "partial";
  handwritten: boolean;
  rotationDegrees: 0 | 90 | 180 | 270;
};

export type OcrInput = {
  /** Short-lived signed URL or data URL — never a public bucket URL. */
  imageUrl: string;
  page?: number;
};

function hasMistralOcr(): boolean {
  return Boolean(process.env.MISTRAL_OCR_API_KEY?.trim());
}

function hasGrok(): boolean {
  return Boolean(process.env.GROK_API_KEY?.trim());
}

/**
 * Transcribe one page image. Returns empty text + failed when keys are missing
 * so the client can show recovery copy without blocking other files.
 */
export async function transcribePage(input: OcrInput): Promise<OcrPageResult> {
  if (hasMistralOcr()) {
    try {
      const mistral = await callMistralOcr(input);
      if (mistral.confidence >= 0.5 && mistral.text.trim()) {
        return mistral;
      }
      // Fall through to Grok when low confidence
      if (hasGrok()) {
        return await callGrokVision(input);
      }
      return mistral;
    } catch {
      if (hasGrok()) return await callGrokVision(input);
    }
  }

  if (hasGrok()) {
    try {
      return await callGrokVision(input);
    } catch (err) {
      console.error("[ocr] vision failed", { page: input.page ?? null, message: err instanceof Error ? err.message : "error" });
    }
  }

  return {
    text: "",
    method: "failed",
    confidence: 0,
    quality: "partial",
    handwritten: false,
    rotationDegrees: 0,
  };
}

async function callMistralOcr(input: OcrInput): Promise<OcrPageResult> {
  // Stub until Mistral OCR client is wired; keep signature stable for callers.
  void input;
  void MODEL_STRONG;
  throw new Error("Mistral OCR not configured for this environment");
}

/**
 * Transcription is not a reasoning task: the fast model reads a page in 2-3s.
 * But when it is out of capacity (xAI 429s) or queued, waiting 20s for it and
 * then starting the strong model cost QA 30s on one scan. So hedge: if the fast
 * read hasn't answered in OCR_HEDGE_MS, or fails, start the strong model in
 * parallel (and one fast retry after a short backoff); first usable read wins.
 */
export const OCR_HEDGE_MS = 8_000;
const OCR_DEADLINE_MS = 30_000;

async function callGrokVision(input: OcrInput): Promise<OcrPageResult> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    let strongStarted = false;
    let fastRetried = false;
    let retryPending = false;
    let running = 0;
    let lastError: unknown = new Error("no_text");
    let lastEmpty: OcrPageResult | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      fn();
    };
    const maybeGiveUp = () => {
      if (running > 0 || retryPending || settled) return;
      if (!strongStarted) return startStrong();
      if (!fastRetried) return;
      finish(() => (lastEmpty ? resolve(lastEmpty) : reject(lastError)));
    };
    const run = (model: string, effort: "none" | "low", label: string) => {
      const remaining = OCR_DEADLINE_MS - (Date.now() - started);
      if (settled || remaining < 3_000) return maybeGiveUp();
      running++;
      callGrokVisionWith(input, model, effort, remaining)
        .then((res) => {
          running--;
          if (res.text.trim().length >= 40) return finish(() => resolve(res));
          lastEmpty = res;
          onFailure();
        })
        .catch((err) => {
          running--;
          lastError = err;
          console.info("[ocr] vision attempt failed", {
            attempt: label,
            ms: Date.now() - started,
            message: err instanceof Error ? err.message.slice(0, 120) : "error",
          });
          if (err instanceof Error && err.message === "missing_key") return finish(() => reject(err));
          onFailure();
        });
    };
    const startStrong = () => {
      if (strongStarted || settled) return;
      strongStarted = true;
      run(MODEL_STRONG, "low", "strong");
    };
    const onFailure = () => {
      startStrong();
      if (!fastRetried) {
        fastRetried = true;
        retryPending = true;
        timers.push(
          setTimeout(() => {
            retryPending = false;
            run(MODEL_FAST, "none", "fast-retry");
          }, 700),
        );
        return;
      }
      maybeGiveUp();
    };
    run(MODEL_FAST, "none", "fast");
    timers.push(setTimeout(startStrong, OCR_HEDGE_MS));
    timers.push(
      setTimeout(() => finish(() => (lastEmpty ? resolve(lastEmpty) : reject(new Error("Request timed out.")))), OCR_DEADLINE_MS),
    );
  });
}

async function callGrokVisionWith(
  input: OcrInput,
  model: string,
  effort: "none" | "low",
  timeout: number,
): Promise<OcrPageResult> {
  // // SOP: coaching only, never generate submission text (transcription only)
  const grok = getGrokClient();
  if (!grok) throw new Error("missing_key");
  const started = Date.now();
  const response = await grok.chat.completions.create(
    {
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
      reasoning_effort: effort,
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    { timeout, maxRetries: 0 },
  );
  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  console.info("[ocr] vision finished", { model, ms: Date.now() - started, page: input.page ?? null, chars: raw.length });
  const text = raw === "NO_TEXT" ? "" : raw;
  if (!assertCoachingOnly(text).ok) throw new Error("guard");
  return {
    text,
    method: text ? "ocr_grok_vision" : "failed",
    confidence: text ? 0.8 : 0,
    quality: text ? "good" : "partial",
    handwritten: false,
    rotationDegrees: 0,
  };
}

/** Client-side blur/dark heuristic (0–1). Below 0.45 → retake prompt. */
export function estimateImageQualityScore(params: {
  width: number;
  height: number;
  /** Optional mean luminance 0–255 from a downsampled pass. */
  meanLuminance?: number;
}): number {
  const { width, height, meanLuminance } = params;
  const pixels = width * height;
  let score = 1;
  if (pixels < 200_000) score -= 0.35;
  else if (pixels < 480_000) score -= 0.15;
  if (meanLuminance != null) {
    if (meanLuminance < 40 || meanLuminance > 230) score -= 0.35;
    else if (meanLuminance < 70 || meanLuminance > 200) score -= 0.15;
  }
  return Math.max(0, Math.min(1, score));
}
