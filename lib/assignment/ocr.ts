/**
 * OCR / vision fallback order for images and scanned PDF pages.
 * // SOP: coaching only, never generate submission text
 *
 * 1. Mistral OCR when MISTRAL_OCR_API_KEY is set
 * 2. Grok vision (MODEL_STRONG) when Mistral is missing, fails, or confidence < 0.5
 * 3. Mark page failed and surface retake UI
 */

import { MODEL_STRONG } from "@/lib/config";

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
    } catch {
      /* fall through */
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

async function callGrokVision(input: OcrInput): Promise<OcrPageResult> {
  // Stub: full Grok vision call lives behind GROK_API_KEY + openai SDK.
  // // SOP: coaching only, never generate submission text
  void input;
  throw new Error("Grok vision OCR not configured for this environment");
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
