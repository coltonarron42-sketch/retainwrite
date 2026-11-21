/**
 * xAI Grok client via the official OpenAI SDK.
 * // SOP: coaching only, never generate submission text
 */

import OpenAI from "openai";
import { MODEL_FAST, MODEL_STRONG } from "@/lib/config";
import { assertCoachingOnly } from "@/lib/ai/guard";

let client: OpenAI | null = null;

export function hasGrokKey(): boolean {
  return Boolean(process.env.GROK_API_KEY?.trim());
}

export function getGrokClient(): OpenAI | null {
  if (!hasGrokKey()) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GROK_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
  }
  return client;
}

export type GrokChatOpts = {
  model: typeof MODEL_FAST | typeof MODEL_STRONG;
  system: string;
  user: string;
  reasoningEffort?: "none" | "low" | "high";
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
  timeoutMs?: number;
};

export async function grokChatJson(opts: GrokChatOpts): Promise<
  | {
      ok: true;
      text: string;
      model: string;
    }
  | {
      ok: false;
      reason: string;
    }
> {
  const grok = getGrokClient();
  if (!grok) return { ok: false, reason: "missing_key" };

  const effort =
    opts.reasoningEffort ??
    (opts.model === MODEL_STRONG ? "low" : "none");

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? (opts.model === MODEL_STRONG ? 30_000 : 8_000),
    );

    // // SOP: coaching only, never generate submission text
    const response = await Promise.race([
      grok.chat.completions.create(
        {
          model: opts.model,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          response_format: opts.jsonSchema
            ? {
                type: "json_schema",
                json_schema: {
                  name: opts.jsonSchema.name,
                  strict: true,
                  schema: opts.jsonSchema.schema,
                },
              }
            : { type: "json_object" },
        },
        {
          signal: controller.signal,
          timeout: opts.timeoutMs ?? (opts.model === MODEL_STRONG ? 30_000 : 8_000),
          // xAI-specific reasoning effort
          headers: { "X-Reasoning-Effort": effort },
        },
      ),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true });
      }),
    ]);
    clearTimeout(timer);

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    const guard = assertCoachingOnly(text);
    if (!guard.ok) return { ok: false, reason: guard.reason };

    console.info("[grok] read finished", { ms: Date.now() - started, model: opts.model, timeout: false });
    return { ok: true, text, model: opts.model };
  } catch (err) {
    const message = err instanceof Error ? err.message : "grok_error";
    const timedOut = /abort|timeout/i.test(message);
    console.info("[grok] read finished", { ms: Date.now() - started, model: opts.model, timeout: timedOut });
    return { ok: false, reason: timedOut ? "timeout" : "request_failed" };
  }
}

export { MODEL_FAST, MODEL_STRONG };
