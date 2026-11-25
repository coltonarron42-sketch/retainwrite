import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { logicOpenerText, stanceTurnParas, STOCK_POOLS, stockLine } from "@/components/stages/loop/stance-chat";
import { stageFromPath, welcomeStateName } from "@/components/stages/stage1/welcome-back";
import { isQuip, STAGE2_QUIPS } from "@/lib/coach/quips";

import { toneIssues } from "@/lib/coach/tone";
import { emptyRequirements, extractedField } from "@/lib/assignment/schema";
import { exampleLeadBatch } from "@/lib/coaching/exampleLeads";
import { pauPauSummaryBubbles, SUMMARY_OPENERS } from "@/lib/stage1/pau-pau";

const read = (p: string) => readFileSync(p, "utf8");
const sentences = (t: string) => t.match(/[^.!?…]+[.!?…]+["”’)]*|[^.!?…]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
const logic = (tier: "pass" | "moderate") => ({ result: { tier, basis: "weak_support", confidence: 0.7, reason: "", citedTerm: null, studentClaimRef: null, logicFailure: null, alternativeAngles: [], reframeAvailable: false } });
const sec = (title: string, mode: "lesson" | "memory", tier: "pass" | "moderate") =>
  ({ key: title.toLowerCase(), title, mode, ideas: [], concept: null, logic: logic(tier) }) as never;
const ctx = (s: never, seed: string, index: number) => ({ section: s, card: null, mirrorAsk: "", activeTrigger: null, seed, index });

/** Everything Pau says from stock in Stage 2 for one whole paper. */
function wholePaper(seed: string, titles: string[], mode: "lesson" | "memory", tier: "pass" | "moderate"): string[] {
  return titles.flatMap((t, i) => {
    const s = sec(t, mode, tier);
    const c = ctx(s, seed, i);
    return [
      ...stanceTurnParas("probe", c),
      ...stanceTurnParas("pick_lead", c),
      ...stanceTurnParas("confirm", c),
      ...stanceTurnParas("logic_opener", c),
      ...stanceTurnParas("logic_result", c),
    ];
  });
}

/** Sentences that don't name the section (those differ anyway). */
function stockSentences(lines: string[], titles: string[]): string[] {
  const named = new RegExp(`\\b(${titles.map((t) => t.toLowerCase()).join("|")})\\b`, "i");
  return lines.flatMap(sentences).filter((s) => !named.test(s));
}

const SEEDS = Array.from({ length: 60 }, (_, i) => `paper-${i}-${(i * 7919).toString(36)}`);

describe("QA 4:42 #2: no stock line repeats verbatim within a paper", () => {
  for (const [titles, label] of [
    [["Introduction", "Body", "Conclusion"], "3 sections"],
    [["Introduction", "Body 1", "Body 2", "Body 3", "Conclusion"], "5 sections"],
  ] as const) {
    for (const mode of ["lesson", "memory"] as const) {
      for (const tier of ["pass", "moderate"] as const) {
        it(`${label}, ${mode} path, ${tier} logic: every stock sentence is said once`, () => {
          for (const seed of SEEDS) {
            const said = stockSentences(wholePaper(seed, [...titles], mode, tier), [...titles]);
            const dupes = said.filter((s, i) => said.indexOf(s) !== i);
            expect(dupes, seed).toEqual([]);
          }
        });
      }
    }
  }
  it("the logic-check opener and confirm vary across sections (QA saw them 3x)", () => {
    for (const seed of SEEDS) {
      const openers = [0, 1, 2].map((i) => logicOpenerText(seed, i).split(".")[0]);
      expect(new Set(openers).size, seed).toBe(3);
      const confirms = [0, 1, 2].map((i) => stockLine("confirm", seed, i));
      expect(new Set(confirms).size, seed).toBe(3);
      const writers = [0, 1, 2].map((i) => stockLine("logic_writer", seed, i));
      expect(new Set(writers).size, seed).toBe(3);
    }
  });
  it("a reload says the same thing (stable per paper)", () => {
    expect(wholePaper("abc", ["Introduction", "Body", "Conclusion"], "lesson", "moderate")).toEqual(
      wholePaper("abc", ["Introduction", "Body", "Conclusion"], "lesson", "moderate"),
    );
  });
  it("every pool line keeps her tone, and pools are unique and big enough", () => {
    for (const [slot, pool] of Object.entries(STOCK_POOLS)) {
      expect(new Set(pool).size, slot).toBe(pool.length);
      expect(pool.length, slot).toBeGreaterThanOrEqual(8);
      for (const line of pool) expect(toneIssues(line.replace("|", " ").replace("{x}", "body").replace("{q}", "")), line).toEqual([]);
    }
  });
  it("at most one quip per stock turn", () => {
    for (const seed of SEEDS)
      for (const line of wholePaper(seed, ["Introduction", "Body", "Conclusion"], "lesson", "moderate"))
        expect(sentences(line).filter(isQuip).length, line).toBeLessThanOrEqual(1);
  });
});

describe("QA 4:42 #2: the read-back has exactly one quip", () => {
  const req = emptyRequirements();
  req.course = extractedField("ENG 10", 0.9, "ENG 10");
  req.topic = extractedField("school start times", 0.9, "school start times");
  it("for every opener, the read-back carries at most one quip", () => {
    for (let i = 0; i < SUMMARY_OPENERS.length; i++) {
      const out = pauPauSummaryBubbles(req, { seed: i }).flatMap(sentences);
      expect(out.filter(isQuip).length, SUMMARY_OPENERS[i]).toBeLessThanOrEqual(1);
    }
  });
  it("retired stock lines never appear in the read-back (QA 9:37 AM)", () => {
    const out = pauPauSummaryBubbles(req, { seed: 0 }).join(" ");
    expect(out).not.toContain("Let's get into it.");
    expect(out).not.toContain("This is totally doable.");
  });
  it("'Future-self approved.' is gone", () => {
    expect(STAGE2_QUIPS as readonly string[]).not.toContain("Future-self approved.");
  });
});

describe("QA 4:42 #4: nothing after the student's closing quote", () => {
  it("no '”.' in a lead title", () => {
    const b = exampleLeadBatch({ concept: null, assignmentText: "Should school start later?", studentIdea: "later start times improve attendance", rubricRef: "prompt", section: { key: "intro", title: "Introduction" } });
    for (const c of b.candidates) expect(c.name).not.toMatch(/”\./);
  });
});

describe("QA 4:42 #1: phone composer never changes height", () => {
  const composer = read("components/stages/stage1/chat-composer.tsx");
  it("textarea height is fixed on phones", () => {
    expect(composer).toMatch(/max-width: 639px[\s\S]{0,80}PHONE_TEXTAREA_H/);
  });
  it("mic trouble is a toast, not a line in the card", () => {
    expect(composer).toContain("callOn && !troubleStatus");
    expect(composer).toMatch(/setMicNote\(callStatusText\(callStatus\)\)/);
  });
});

describe("QA 4:42 #3: leads wait for the model search terms", () => {
  it("a placeholder shows while terms are pending, with a ~15s fallback", () => {
    expect(read("components/stages/loop/stance-chat.tsx")).toContain("Finding search ideas…");
    expect(read("components/stages/loop/coaching-loop.tsx")).toMatch(/TERMS_WAIT_MS = 15000/);
  });
});

describe("QA 4:42 #6a: welcome-back cooldown per paper and stage", () => {
  it("stages keep separate cooldowns", () => {
    expect(welcomeStateName("p", 2)).not.toBe(welcomeStateName("p", 3));
    expect(welcomeStateName("p", 1)).toContain("p");
    expect(stageFromPath("/app/papers/abc/stage/3")).toBe(3);
    expect(stageFromPath("/app/papers/abc/stage/2/")).toBe(2);
    expect(stageFromPath("/app/papers/abc")).toBe(1);
  });
});

describe("QA 4:42 #7: the TTS response names the voice", () => {
  it("sends x-pau-voice with the voice that actually spoke (iris by default)", () => {
    const route = read("app/api/voice/tts/route.ts");
    expect(route).toContain('"x-pau-voice": used');
    expect(read("lib/voice/tts-config.ts")).toMatch(/TTS_DEFAULT_VOICE: TtsCandidate = "iris"/);
  });
});
