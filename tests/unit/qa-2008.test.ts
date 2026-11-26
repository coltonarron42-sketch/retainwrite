// QA 8:08 PM: Mute shows "Your mic is muted" at once, typed sends are not
// held up by the intent model, and no cartoon line in the welcome.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const order: string[] = [];
let releaseAuth: (v: null) => void = () => {};
vi.mock("@/lib/ai/grok", () => ({
  MODEL_FAST: "fast",
  grokChatJson: vi.fn(async () => {
    order.push("model");
    return { ok: true, text: JSON.stringify({ intent: "content" }) };
  }),
}));
vi.mock("@/lib/demo/session-server", () => ({ getDemoSession: vi.fn(async () => null) }));
vi.mock("@/lib/env", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/auth/paper-access", () => ({
  hasAuthCookie: vi.fn(async () => true),
  paperOwnerDenied: vi.fn(
    () =>
      new Promise((resolve) => {
        order.push("auth");
        releaseAuth = (v) => {
          order.push("auth-done");
          resolve(v);
        };
      }),
  ),
}));
import { callStatusText } from "@/lib/voice/call";
import { WELCOME_BACK_LINES } from "@/lib/coach/welcome-back";
import { STAGE2_QUIPS, SIGNATURE_QUIP } from "@/lib/coach/quips";
import { needsModel, rulesStanceIntent } from "@/lib/stages/stance-intent";

const read = (p: string) => readFileSync(p, "utf8");

describe("#1 Mute status shows right away", () => {
  const src = read("components/stages/stage1/chat-composer.tsx");
  it("a mute wins over an earlier mic trouble (blocked/error), so the row says muted at once", () => {
    expect(src).toMatch(/: micMuted\s*\? "muted"\s*: callTrouble\s*\? callTrouble/);
  });
  it("any mute change clears old trouble; muting also clears the trouble toast", () => {
    expect(src).toMatch(/useEffect\(\(\) => \{\s*setCallTrouble\(null\);\s*if \(micMuted\) setMicNote\(null\);\s*\}, \[micMuted\]\);/);
    expect(callStatusText("muted")).toBe("Your mic is muted. Type, or unmute to talk.");
  });
});

describe("#2 typed sends", () => {
  const loop = read("components/stages/loop/coaching-loop.tsx");
  it("explicit requests/questions use the rules answer without a model round trip", () => {
    expect(rulesStanceIntent("can you help me")).not.toBe("content");
    expect(needsModel("can you help me")).toBe(true); // the server would still ask the model
    expect(loop).toMatch(/if \(rules !== "content" \|\| !needsModel\(text\)\) return Promise\.resolve\(rules\);/);
  });
  it("the intent check is capped so a slow model can't hold the reply (rules decide after the cap)", () => {
    expect(loop).toContain("const STANCE_INTENT_CLIENT_MS = 2200;");
    expect(loop).toMatch(/setTimeout\(\(\) => controller\.abort\(\), STANCE_INTENT_CLIENT_MS\)/);
    const route = read("app/api/papers/[paperId]/stance/intent/route.ts");
    expect(route).toContain("const INTENT_MODEL_TIMEOUT_MS = 1_800;");
    expect(read("app/api/papers/[paperId]/assignment/reply/route.ts")).toMatch(/const denied = [\s\S]*grokChatJson\([\s\S]*await denied/);
  });
  beforeEach(() => {
    order.length = 0;
  });
  it("intent route: the model call starts while the owner check is still running", async () => {
    const { POST } = await import("@/app/api/papers/[paperId]/stance/intent/route");
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ message: "teens need sleep" }) });
    const p = POST(req, { params: Promise.resolve({ paperId: "153a0709-1f62-48a1-bcad-a9edfa671e20" }) });
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(["auth", "model"]);
    releaseAuth(null);
    const res = await p;
    expect(await res.json()).toEqual({ intent: "content", source: "model" });
  });
  it("intent route: a failed owner check still wins over the model answer", async () => {
    const { POST } = await import("@/app/api/papers/[paperId]/stance/intent/route");
    const { NextResponse } = await import("next/server");
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ message: "teens need sleep" }) });
    const p = POST(req, { params: Promise.resolve({ paperId: "153a0709-1f62-48a1-bcad-a9edfa671e20" }) });
    await new Promise((r) => setTimeout(r, 10));
    releaseAuth(NextResponse.json({ error: "Not found" }, { status: 404 }) as unknown as null);
    expect((await p).status).toBe(404);
  });
  it("Stage 1 replies are sent before the session event is logged", () => {
    const route = read("app/api/papers/[paperId]/assignment/reply/route.ts");
    expect(route).toMatch(/after\(\(\) =>\s*logSessionEvent\(/);
    expect(route).not.toMatch(/await logSessionEvent/);
  });
});

describe("#2 the intent check starts while typing pauses", () => {
  const loop = read("components/stages/loop/coaching-loop.tsx");
  const chat = read("components/stages/loop/stance-chat.tsx");
  const outline = read("components/stages/loop/outline-chat.tsx");
  it("same section, ask and words reuse one check (whitespace-insensitive)", async () => {
    const { intentKey } = await import("@/components/stages/loop/coaching-loop");
    expect(intentKey("intro", " Ask? ", "My  brother sleeps\n in class ")).toBe(intentKey("intro", "Ask?", "My brother sleeps in class"));
    expect(intentKey("intro", "Ask?", "a b")).not.toBe(intentKey("body", "Ask?", "a b"));
    expect(loop).toMatch(/const hit = intentCache\.current\.get\(key\);\s*if \(hit\) return hit;/);
  });
  it("a 600 ms typing pause warms the check in Stage 2 and Stage 3; plain yes and untouched notes don't", async () => {
    const { INTENT_WARM_MS } = await import("@/components/stages/loop/stance-chat");
    expect(INTENT_WARM_MS).toBe(600);
    expect(chat).toContain('<IntentWarm idea={isPlainYes(idea) || isConfirmOnly(idea) ? "" : idea} ask={ask} classify={props.classify} />');
    expect(outline).toContain('<IntentWarm idea={current && text.trim() !== notes.trim() ? text : ""} ask={ask.slice(-2).join(" ")}');
    // Send uses the same ask string as the warm-up, so the cache key matches.
    expect(chat).toMatch(/await props\.classify\(text, ask\)/);
    expect(outline).toMatch(/const askText = ask\.slice\(-2\)\.join\(" "\);[\s\S]*props\.classify\(value, askText\)/);
  });
});

describe("#3 the only cartoon joke is the signature quip", () => {
  it("no welcome line jokes about being a cartoon or standing up", () => {
    for (const line of WELCOME_BACK_LINES) expect(line).not.toMatch(/cartoon|stand up/i);
    expect(STAGE2_QUIPS.filter((q) => /cartoon/i.test(q))).toEqual([]);
    const files = ["lib/coach/welcome-back.ts", "components/stages/stage1/welcome-back.tsx", "lib/coach/personality.ts", "components/stages/loop/stance-chat.tsx"];
    for (const f of files) expect(read(f)).not.toMatch(/stand up, but/i);
  });
});
