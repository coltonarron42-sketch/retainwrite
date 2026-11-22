import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanSearchTerm, exampleLeadBatch, noteFocus } from "@/lib/coaching/exampleLeads";
import { isCleanQuery, parseSearchTerm, SEARCH_TERM_SCHEMA } from "@/lib/coaching/searchTerm";
import { asHeading } from "@/lib/copy/topic-phrase";
import { tidyQuotePunct } from "@/lib/copy/quote-punct";

const sheet = "Prompt: Should high schools start later? Write an argument essay with an introduction, body and conclusion.";

describe("QA 2:31 #3a: no template '?' inside a student quote", () => {
  const ideas = [
    "My own idea is about sleep.",
    "My own idea is about sleep",
    "Teens need more sleep, so school should start later!",
    "Is a later bell fair to parents?",
  ];
  for (const idea of ideas) {
    for (const key of ["intro", "body", "conclusion"]) {
      it(`${key}: ${idea}`, () => {
        const b = exampleLeadBatch({ concept: null, assignmentText: sheet, studentIdea: idea, rubricRef: "prompt", section: { key, title: key } });
        for (const c of b.candidates) {
          // The quote's own end mark stays; nothing is added after or inside it.
          expect(c.name).not.toMatch(/[”"]\?/);
          if (c.name.includes("“")) expect(c.name).toMatch(/^You wrote “/);
        }
      });
    }
  }
  it("keeps the student's own punctuation", () => {
    const b = exampleLeadBatch({ concept: null, assignmentText: sheet, studentIdea: "My own idea is about sleep.", rubricRef: "prompt", section: { key: "intro", title: "Introduction" } });
    expect(b.candidates[0]!.name).toMatch(/^You wrote “My own idea is about sleep\.” .+\?$/);
  });
  it("tidy only dedupes", () => {
    expect(tidyQuotePunct("You wrote “sleep.” Why?")).toBe("You wrote “sleep.” Why?");
    expect(tidyQuotePunct("About “sleep”?")).toBe("About “sleep”?");
  });
});

describe("QA 2:31 #3b: whole-sentence quotes", () => {
  it("keeps the clause after the comma", () => {
    const n = "My first period class is half asleep, so starting at 8:30 would help us actually learn. Also buses.";
    expect(noteFocus(n)).toBe("My first period class is half asleep, so starting at 8:30 would help us actually learn.");
  });
  it("trims a very long sentence with an ellipsis, not at a comma", () => {
    const long = "Students, " + Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ") + ".";
    const f = noteFocus(long);
    expect(f.endsWith("…")).toBe(true);
    expect(f).not.toMatch(/,\s*…$/);
  });
  it("conclusion title quotes the whole sentence", () => {
    const b = exampleLeadBatch({ concept: null, assignmentText: sheet, studentIdea: "My first period class is half asleep, so starting at 8:30 would help us actually learn.", rubricRef: "prompt", section: { key: "conclusion", title: "Conclusion" } });
    expect(b.candidates[0]!.name).toContain("so starting at 8:30 would help us actually learn.”");
  });
});

describe("QA 2:31 #3c: search terms", () => {
  it("validates model queries", () => {
    expect(isCleanQuery("teen sleep and school start times")).toBe(true);
    expect(isCleanQuery("sleep")).toBe(false);
    expect(isCleanQuery("high schools start later about")).toBe(false);
    expect(isCleanQuery("my best part of sleep")).toBe(false);
    expect(isCleanQuery("one two three four five six seven")).toBe(false);
    expect(parseSearchTerm({ query: "Teen Sleep and School Start Times" })).toBe("teen sleep and school start times");
    expect(parseSearchTerm({ query: "times teen" })).toBeNull();
    expect(parseSearchTerm(null)).toBeNull();
    expect(SEARCH_TERM_SCHEMA.required).toContain("query");
  });
  it("keyword fallback drops filler tails", () => {
    for (const [raw, bad] of [
      ["high schools start later about sleep about", /\babout$/],
      ["school start later best part", /\b(best|part)$/],
      ["later start times teen", /\bteen$/],
    ] as const) {
      const out = cleanSearchTerm(raw, "school start times");
      expect(out).not.toMatch(bad);
      const n = out.split(" ").length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
  it("leads use the model query when given", () => {
    const b = exampleLeadBatch({ concept: null, assignmentText: sheet, studentIdea: "Teens need sleep.", rubricRef: "prompt", section: { key: "body", title: "Body" }, searchTerm: "teen sleep and school start times" });
    expect(b.candidates.some((c) => c.whyFits.includes("teen sleep and school start times"))).toBe(true);
  });
});

describe("QA 2:31 #4: typed-assignment heading", () => {
  it("turns a whether-clause into a question title", () => {
    expect(asHeading("whether high schools should start later.")).toBe("Should high schools start later?");
    expect(asHeading("Whether or not phones are allowed in class")).toBe("Are phones allowed in class?");
  });
});

describe("QA 2:31 #5 + design: waves fade out, brows, tilt", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const tsx = readFileSync("components/stages/stage1/pau-presence.tsx", "utf8");
  it("waves keep a 0.4s exit animation before unmount", () => {
    expect(css).toMatch(/\.pp-waves-out\s*\{\s*animation: pp-fade-out 0\.4s/);
    expect(tsx).toMatch(/pp-waves-out/);
    expect(tsx).toMatch(/setMounted\(false\), 450/);
  });
  it("reduced motion: no exit animation, no tilt", () => {
    const reduce = css.slice(css.indexOf(".pp-waves-out {\n    animation: none") - 200);
    expect(reduce).toMatch(/\.pp-waves-out\s*\{\s*animation: none;\s*opacity: 0;/);
    expect(css).toMatch(/no-preference\) \{[^@]*\.pp-tilt\s*\{\s*animation: pp-tilt/);
    expect(css).toMatch(/@keyframes pp-tilt[\s\S]*rotate\(-3deg\)/);
  });
  it("brows are visible at 40px", () => {
    expect(tsx).toMatch(/strokeOpacity="0\.92" strokeWidth="1\.8"/);
  });
});
