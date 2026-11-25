/**
 * QA 12:25 follow-ups: on-topic start-time notes are not "doesn't yet speak",
 * story-options accepts long voice answers, hidden draft parses lenient output.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { finalizeLogicCheck, logicCheckFromNotes, notesAddressAssignment, notesOnPrompt, timeCue } from "@/lib/coaching/logicCheck";
import { RELEVANCE_SYSTEM } from "@/lib/coaching/relevance";
import { HIDDEN_SHAPE, hiddenDraftPrompt, parseHiddenModel } from "@/lib/drafting/hiddenPlan";

const read = (p: string) => readFileSync(p, "utf8");
const prompt = "Should high schools start classes later in the morning?";
const sheet = `ENG 102 Argumentative Essay. Prompt: ${prompt} Take a clear position and support it with evidence. Use at least three credible sources. APA 7.`;

function check(notes: string, onPrompt: boolean | null, mode: "lesson" | "memory") {
  const raw = logicCheckFromNotes({ notes, assignmentText: sheet, rubricRef: "lesson_concept", mode, confirmedPrompt: prompt, onPrompt });
  return finalizeLogicCheck(raw, { assignmentText: sheet, studentNotes: notes, mode, rubricRequiresCounterargument: false, validRubricRefs: ["lesson_concept", "prompt"] }).result;
}

const onTopic = [
  "My first period class is half asleep, so starting at 8:30 would help us actually learn.",
  "If the bell rang at 9 instead of 7:25, kids would show up awake.",
  "Pushing school to 8:45 a.m. gives teens an extra hour of rest.",
  "Later start times would mean fewer kids sleeping through first period.",
  "Our zero period at 6:50 is brutal, and grades in that block are the lowest.",
  "Moving the first bell later would cut down on tardies.",
  "Starting later lets athletes recover after evening practice.",
];

describe("#1 start-time notes count as on-topic (model and fallback)", () => {
  for (const notes of onTopic) {
    for (const onPrompt of [null, true] as const) {
      for (const mode of ["lesson", "memory"] as const) {
        it(`${onPrompt === null ? "fallback" : "model"} ${mode}: “${notes.slice(0, 40)}…”`, () => {
          const r = check(notes, onPrompt, mode);
          expect(r.tier).not.toBe("strong");
          expect(r.reason ?? "").not.toMatch(/doesn't yet speak to what the assignment asks/);
          expect(notesOnPrompt(notes, prompt, sheet)).toBe(true);
        });
      }
    }
  }
  it("the exact QA sentence addresses the sheet", () => {
    expect(notesAddressAssignment(onTopic[0], sheet)).toBe(true);
    expect(timeCue("starting at 8:30", prompt)).toBe(true);
  });
  it("off-topic notes are still caught", () => {
    expect(notesOnPrompt("The cafeteria pizza is the best part of any school day.", prompt, sheet)).toBe(false);
    expect(check("The cafeteria pizza is the best part of any school day.", null, "lesson").tier).toBe("strong");
    expect(timeCue("My cat likes tuna", prompt)).toBe(false);
  });
  it("the model prompt names schedule details as on-topic", () => {
    expect(RELEVANCE_SYSTEM).toMatch(/8:30/);
    expect(RELEVANCE_SYSTEM).toMatch(/first period/);
  });
});

describe("#2 story-options accepts long voice answers", () => {
  it("phrases are sliced, not rejected", async () => {
    const { z } = await import("zod");
    const src = read("app/api/papers/[paperId]/intake/story-options/route.ts");
    expect(src).not.toMatch(/z\.string\(\)\.max\(200\)\)/);
    expect(src).toMatch(/slice\(0, 400\)/);
    expect(z).toBeTruthy();
    const client = read("components/stages/stage1/assignment-intake.tsx");
    expect(client).toMatch(/phrases\.slice\(0, 20\)\.map\(\(p\) => p\.slice\(0, 400\)\)/);
  });
});

describe("#5 hidden draft", () => {
  it("prompt carries the response shape", () => {
    const p = hiddenDraftPrompt({ sections: [], ideas: [], wordTarget: 900 } as never);
    expect(JSON.stringify(p)).toContain("sentenceWeight");
    expect(HIDDEN_SHAPE).toContain("placement");
  });
  it("parses a reply that leaves out empty signal lists", () => {
    const r = parseHiddenModel({ text: { sections: [] }, signals: { placement: [] } }, "h1", "CANARY");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.signals.ledgerHash).toBe("h1");
    expect(parseHiddenModel({ nope: 1 }, "h1", "CANARY").ok).toBe(false);
  });
  it("runs at low effort through the shared guarded client", () => {
    const src = read("lib/server/hiddenDraft/generate.ts");
    expect(src).toMatch(/reasoningEffort: "low"/);
    expect(src).toMatch(/grokChatJson/);
  });
});

describe("#3 logout stops autosave", () => {
  it("persistField does not call the server after logout, and a 401 stops later saves", async () => {
    const { markSignedOut, clearSignedOut, signedOut, onSignedOut } = await import("@/lib/session/signedOut");
    const { persistField } = await import("@/lib/papers/persist");
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      return new Response("{}", { status: 401 });
    }) as typeof fetch;
    try {
      clearSignedOut();
      let fired = 0;
      const off = onSignedOut(() => (fired += 1));
      expect(await persistField("p1", { fieldKey: "a", text: "x" })).toBe(false);
      expect(calls.length).toBe(1);
      expect(signedOut()).toBe(true);
      expect(fired).toBe(1);
      expect(await persistField("p1", { fieldKey: "a", text: "y" })).toBe(false);
      expect(calls.length).toBe(1);
      off();
      clearSignedOut();
      markSignedOut();
      expect(await persistField("p1", { fieldKey: "a", text: "z" })).toBe(false);
      expect(calls.length).toBe(1);
    } finally {
      globalThis.fetch = orig;
      clearSignedOut();
    }
  });
  it("the Log out button marks the session gone before anything else", () => {
    const src = read("components/auth/log-out-button.tsx");
    expect(src.indexOf("markSignedOut()")).toBeGreaterThan(-1);
    expect(src.indexOf("markSignedOut()")).toBeLessThan(src.indexOf("stopSpeech()"));
    expect(read("lib/papers/use-draft-save.ts")).toMatch(/onSignedOut\(\(\) => window\.clearTimeout\(timer\)\)/);
    expect(read("lib/drafting/requestMilestone.ts")).toMatch(/if \(signedOut\(\)\) return;/);
  });
});

describe("#4 a send during a reply is never dropped, and never sent twice (QA 9:37 AM)", () => {
  it("the composer keeps the text and turns Send off while a reply is in flight", () => {
    const src = read("components/stages/stage1/chat-composer.tsx");
    // QA 3:51: the box stays live; Enter during a reply queues the full text (shown), sent after.
    expect(src).toContain("setQueuedText((prev) => (prev ? `${prev}\\n${t}` : t));");
    expect(src).toMatch(/Queued: “/);
    expect(src).toContain("disabled={blocked}");
    expect(src).not.toMatch(/if \(!sending\) send\(\);/);
  });
  it("the Stance loop clears only the text it sent", () => {
    const src = read("components/stages/loop/coaching-loop.tsx");
    expect(src).not.toMatch(/\n    setIdea\(""\);/);
    expect(src).toMatch(/cur\.trim\(\) === sent\.trim\(\) \? "" : cur/);
  });
});

describe("presence: face, glance/blink, speaking waves", () => {
  it("matches the bubble being read (start event sentence)", async () => {
    const { bubbleIsSpeaking } = await import("@/lib/voice/presence");
    const bubble = "Nice. Pau thinks that's a strong start. What would you say to someone who disagrees?";
    expect(bubbleIsSpeaking(bubble, "Pow thinks that's a strong start.")).toBe(true);
    expect(bubbleIsSpeaking(bubble, "What would you say to someone who disagrees?")).toBe(true);
    expect(bubbleIsSpeaking(bubble, "Which source will you check first?")).toBe(false);
    expect(bubbleIsSpeaking(bubble, null)).toBe(false);
  });
  it("waves follow the utterance's real start/end and stop", () => {
    const src = read("lib/voice/speech.ts");
    expect(src).toMatch(/u\.onstart = \(\) => \{\s*if \(gen === generation && !finished\) \{\s*started = true;\s*setTapNeeded\(false\);\s*audibleEnded = false;\s*setAudible\(next\);/);
    expect(src).toMatch(/setSpeaking\(false\);\s*audibleEnded = true;\s*setAudible\(null\);\s*setTapNeeded\(false\);/);
  });
  it("voice off shows nothing; waves never take layout space", async () => {
    const p = read("components/stages/stage1/pau-presence.tsx");
    expect(p).toMatch(/return voice && bubbleIsSpeaking\(text, sentence\);/);
    expect(p).toMatch(/pointer-events-none absolute/);
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { PauPauGroup } = await import("@/components/stages/stage1/chat-bubbles");
    const html = renderToStaticMarkup(createElement(PauPauGroup, { bubbles: ["Hello there, what do you think?"] }));
    expect(html).not.toContain("data-pau-waves");
    expect(html).toContain('data-pau-face="still"');
    expect(html).not.toContain(">PP<");
  });
  it("motion is CSS-only and off under reduced motion", () => {
    const css = read("app/globals.css");
    const block = css.slice(css.indexOf("Pau presence"));
    expect(block).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*\.pp-blink/);
    expect(block).toMatch(/@keyframes pp-glance/);
    expect(block).toMatch(/@keyframes pp-blink/);
    expect(read("components/stages/stage1/voice.tsx")).toMatch(/<PauFace alive className="hidden h-7 w-7 sm:block" \/>/);
  });
});
