import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { logicOpenerText, stanceTurnParas } from "@/components/stages/loop/stance-chat";
import { isQuip, oneQuip, oneQuipParas, quipFor, STAGE2_QUIPS } from "@/lib/coach/quips";
import { SAMPLE_QUIPS } from "@/lib/coach/personality";
import { exampleLeadBatch } from "@/lib/coaching/exampleLeads";
import { parseSearchTerms } from "@/lib/coaching/searchTerm";
import { emptyRequirements, extractedField } from "@/lib/assignment/schema";
import { parseModelResult } from "@/lib/stage1/confirm-reply";
import { pauPauSummaryBubbles } from "@/lib/stage1/pau-pau";
import { callStatusText } from "@/lib/voice/call";

const read = (p: string) => readFileSync(p, "utf8");
const sec = (title: string) => ({ key: title.toLowerCase(), title, mode: "lesson", ideas: [], concept: null }) as never;
const ctx = (title: string, seed: string, index: number) => ({ section: sec(title), card: null, mirrorAsk: "", activeTrigger: null, seed, index });
const SECTIONS = ["Introduction", "Body 1", "Body 2", "Body 3", "Conclusion"];

/** Every line Pau Pau says across one paper's Stage 2 openers. */
function paperLines(seed: string): string[][] {
  return SECTIONS.flatMap((t, i) => [
    stanceTurnParas("probe", ctx(t, seed, i)),
    stanceTurnParas("pick_lead", ctx(t, seed, i)),
    [logicOpenerText(seed, i)],
  ]);
}

describe("QA 3:35 A: 390px composer is pinned", () => {
  const dock = read("components/stages/stage1/chat-bubbles.tsx");
  const composer = read("components/stages/stage1/chat-composer.tsx");
  it("dock is fixed to the bottom on phones with a safe-area inset and a spacer", () => {
    expect(dock).toMatch(/"fixed inset-x-0 z-20[^"]*pb-\[max\(12px,env\(safe-area-inset-bottom\)\)\][^"]*sm:sticky/);
    expect(dock).toContain("data-composer-spacer");
  });
  it("status row has a fixed height; notes and the mic line float above it", () => {
    expect(composer).toMatch(/flex h-\[56px\] items-center/);
    expect(composer).toContain("data-mic-toast");
    expect(composer).toMatch(/absolute inset-x-0 bottom-full/);
  });
  it("status lines are short enough for one row at 390px", () => {
    for (const s of ["unsupported", "blocked", "error"] as const) expect((callStatusText(s) ?? "").length).toBeLessThanOrEqual(52);
  });
});

describe("QA 3:35 B: personality copy", () => {
  it("'Riveting stuff' is gone everywhere", () => {
    for (const f of ["lib/stage1/pau-pau.ts", "lib/coach/personality.ts", "lib/coach/quips.ts", "lib/coaching/memoryPath.ts"]) expect(read(f)).not.toMatch(/Riveting/);
  });
  it("first section opens with a first-section line, never 'New section, fresh start'", () => {
    const first = stanceTurnParas("probe", ctx("Introduction", "p1", 0)).join(" ");
    expect(first).toMatch(/^Let's start with your introduction\./);
    for (let i = 0; i < 5; i++) expect(stanceTurnParas("probe", ctx("Body", "p1", i)).join(" ")).not.toMatch(/New section, fresh start/);
    expect(stanceTurnParas("probe", ctx("Body 1", "p1", 1)).join(" ")).toMatch(/^On to your body 1\./);
  });
  it("no verbatim quip repeats across sections in one paper, and at most one 'I promise'", () => {
    for (const seed of ["11111111-aaaa", "b2c3", "paper-xyz", "00000000-0000-0000-0000-000000000000"]) {
      const said = paperLines(seed).flat();
      const quips = said.flatMap((p) => p.split(/(?<=[.?])\s+/)).filter(isQuip);
      expect(new Set(quips).size).toBe(quips.length);
      expect(said.join(" ").match(/I promise/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });
  it("the deal runs out instead of repeating", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++)
      for (const slot of ["pick_lead", "logic_opener"] as const) {
        const q = quipFor("seed", i, slot);
        if (q) {
          expect(seen.has(q)).toBe(false);
          seen.add(q);
        }
      }
    expect(seen.size).toBeLessThanOrEqual(STAGE2_QUIPS.length);
  });
  it("at most one quip per reply: templates, read-back and model replies", () => {
    expect(oneQuip("No crystal ball required. Painless, mostly. You ready?")).toBe("No crystal ball required. You ready?");
    expect(oneQuipParas(["Okay. Painless, mostly.", "This is totally doable. Ready?"])).toEqual(["Okay. Painless, mostly.", "Ready?"]);
    const r = parseModelResult({ intent: "confirm", reply: "No crystal ball required. Painless, mostly. Let's go.", updates: {} });
    expect(r?.reply).toBe("No crystal ball required. Let's go.");
    for (let seed = 0; seed < 8; seed++) {
      const req = emptyRequirements();
      req.course = extractedField("ENG 101", 0.9);
      req.length = extractedField({ wordsMin: 1200, wordsMax: 1500 }, 0.9);
      req.topic = extractedField("Should high schools start later in the morning?", 0.9);
      const said = pauPauSummaryBubbles(req, { seed }).join(" ");
      const quips = said.split(/(?<=[.?])\s+/).filter(isQuip);
      expect(quips.length).toBeLessThanOrEqual(1);
    }
    for (const q of SAMPLE_QUIPS) expect(isQuip(q)).toBe(true);
  });
});

describe("QA 3:35 C: search terms for all sections in one call", () => {
  it("parses a batch by section key and drops bad or unknown ones", () => {
    const out = parseSearchTerms(
      { queries: [{ key: "intro", query: "Teen sleep and school start times" }, { key: "body", query: "my best part about" }, { key: "x", query: "school start times" }] },
      ["intro", "body"],
    );
    expect(out).toEqual({ intro: "teen sleep and school start times" });
  });
  it("Stage 2 asks once for every section when it loads and caches per paper", () => {
    const loop = read("components/stages/loop/coaching-loop.tsx");
    expect(loop).toMatch(/sections: termSections/);
    expect(loop).toMatch(/searchTerms:\$\{paperId\}/);
    expect(loop).not.toMatch(/termKey in searchTerms/);
  });
});

describe("QA 3:35 D: nits", () => {
  const sheet = "Write a 1,500-word argumentative essay on whether schools should start later.";
  it("adds no '.' inside the student's quote", () => {
    const b = exampleLeadBatch({ concept: null, assignmentText: sheet, studentIdea: "pizza is good", rubricRef: "prompt", section: { key: "body", title: "Body" } });
    expect(b.candidates[0]!.name).toMatch(/^You wrote “pizza is good” — what /);
    expect(b.candidates[0]!.name).not.toMatch(/”\./);
    expect(b.candidates[0]!.name).not.toContain("good.”");
  });
  it("one framing rule: only the first title quotes, later ones say 'your point'", () => {
    for (const key of ["intro", "body", "conclusion"]) {
      const b = exampleLeadBatch({ concept: null, assignmentText: sheet, studentIdea: "Teens need more sleep.", rubricRef: "prompt", section: { key, title: key } });
      expect(b.candidates[0]!.name).toMatch(/^You wrote “/);
      for (const c of b.candidates.slice(1)) expect(c.name).not.toContain("You wrote");
    }
  });
  it("grey secondary text is at least WCAG AA 4.5:1 on cream", () => {
    const css = read("app/globals.css");
    const lum = (h: string) => {
      const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x! + 0.05) / (y! + 0.05);
    };
    for (const v of ["--ds-muted", "--ds-faint"]) {
      const hex = css.match(new RegExp(`${v}: (#[0-9a-f]{6})`, "i"))![1]!;
      for (const bg of ["#faf7f2", "#F7EFE0"]) expect(ratio(hex, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("QA 3:35 E: Sources header shows the face (presence only)", () => {
  it("stage 4 header renders PauFace", () => {
    expect(read("components/stages/loop/coaching-loop.tsx")).toMatch(/stage === 4 \? <PauFace alive/);
  });
});
