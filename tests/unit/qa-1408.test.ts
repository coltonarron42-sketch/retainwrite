/** QA 2:08 PM follow-ups: double send, named style, quote punctuation, search terms, purpose line, presence. */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { assignmentPurposeLine, cleanSearchTerm, exampleLeadBatch, noteFocus } from "@/lib/coaching/exampleLeads";
import { finalizeLogicCheck, logicCheckFromNotes } from "@/lib/coaching/logicCheck";
import { tidyQuotePunct } from "@/lib/copy/quote-punct";
import { citationComfortQuestion } from "@/lib/stage1/comfort";

const read = (p: string) => readFileSync(p, "utf8");
const prompt = "Should high schools start classes later in the morning?";
const sheet = `ENG 102 Argumentative Essay. Prompt: ${prompt} Take a clear position. APA 7.`;

describe("#4 one send at a time, box clears on send, no duplicate replies", () => {
  const stance = read("components/stages/loop/stance-chat.tsx");
  const loop = read("components/stages/loop/coaching-loop.tsx");
  it("the box empties the moment a message is sent", () => {
    expect(stance).toMatch(/inFlight\.current = true;\s*setChecking\(true\);[\s\S]{0,200}props\.onIdea\(""\);/);
  });
  it("a synchronous in-flight guard and the whole send counts as busy (queue waits)", () => {
    expect(stance).toMatch(/if \(!text \|\| checking \|\| inFlight\.current\) return;/);
    expect(stance).toMatch(/finally \{\s*inFlight\.current = false;\s*setChecking\(false\);/);
    expect(stance).toMatch(/await h\.probeSave/);
    expect(loop).toMatch(/probeSave: \(more, opts\) => onProbeSave\(more, opts\)/);
  });
  it("an unsaved note goes back in the box; the same aside is never appended twice", () => {
    expect(loop).toMatch(/setThinNote\(probe\);\s*restore\(idea\);/);
    expect(loop).toMatch(/Never the same answer twice in a row/);
  });
});

describe("#6 the comfort question names the style", () => {
  it("other + ASA says ASA", () => {
    expect(citationComfortQuestion({ citationStyle: { value: "other" }, citationStyleOther: "ASA" })).toBe("How comfortable are you with ASA citations so far?");
    expect(citationComfortQuestion({ citationStyle: { value: "APA 7" } })).toBe("How comfortable are you with APA 7 citations so far?");
    expect(citationComfortQuestion({ citationStyle: { value: "other" } })).toBe("How comfortable are you with the required citations so far?");
    expect(citationComfortQuestion({ citationStyle: { value: null } })).not.toMatch(/other/);
  });
});

describe("#7a/#7b quote punctuation", () => {
  it("never moves a ? into a quote; only dedupes (QA 2:31 #3a)", () => {
    expect(tidyQuotePunct("How does this connect to “Should schools start later?”?")).toBe("How does this connect to “Should schools start later?”");
    expect(tidyQuotePunct("Really??")).toBe("Really?");
    expect(tidyQuotePunct("No quotes here.")).toBe("No quotes here.");
    expect(tidyQuotePunct("About “My sister is tired”?")).not.toMatch(/tired\?”/);
  });
  it("lead titles never end ”? and the note focus is a whole clause", () => {
    const b = exampleLeadBatch({ concept: null, assignmentText: sheet, studentIdea: "My sister is tired every school morning, so I think the bell should move later and let teens sleep.", rubricRef: "prompt", section: { key: "intro", title: "Introduction" } });
    for (const c of b.candidates) {
      expect(c.name).not.toMatch(/[”"]\?/);
      expect(c.name).not.toMatch(/so I…/);
    }
    expect(noteFocus("My sister is tired every school morning, so I think the bell should move later.")).toBe("My sister is tired every school morning, so I think the bell should move later.");
  });
  it("the off-topic alert's angle has one '?'", () => {
    const raw = logicCheckFromNotes({ notes: "The cafeteria pizza is the best food ever made.", assignmentText: sheet, rubricRef: "prompt", mode: "lesson", confirmedPrompt: prompt, onPrompt: false });
    const r = finalizeLogicCheck(raw, { assignmentText: sheet, studentNotes: "x", mode: "lesson", rubricRequiresCounterargument: false, validRubricRefs: ["prompt"] }).result;
    for (const a of r.alternativeAngles) expect(a.question).not.toMatch(/\?[”"]\?|\?\?/);
  });
});

describe("#7c search terms are clean keywords", () => {
  const cases = [
    "high schools should start later times improve teen",
    "high schools start later in the morning because I think it would help",
    "so I think that teens should sleep more",
  ];
  for (const t of cases) {
    it(`“${t}”`, () => {
      const out = cleanSearchTerm(t, "school start times");
      const words = out.split(" ");
      expect(words.length).toBeGreaterThanOrEqual(2);
      expect(words.length).toBeLessThanOrEqual(6);
      expect(out).not.toMatch(/\b(should|would|think|because|improve|so|that|i)\b/);
    });
  }
  it("leads use them (body section)", () => {
    const b = exampleLeadBatch({ concept: null, assignmentText: "Prompt: Do high schools should start later? Later start times improve teen sleep.", studentIdea: "Later start times improve teen sleep and grades.", rubricRef: "prompt", section: { key: "body", title: "Body" } });
    const term = b.candidates[0]!.whyFits.match(/for “([^”]+)”/)?.[1] ?? "";
    expect(term.split(" ").length).toBeGreaterThanOrEqual(2);
    expect(term.split(" ").length).toBeLessThanOrEqual(6);
    expect(term).not.toMatch(/\b(should|improve)\b/);
  });
});

describe("#7d purpose line reads naturally", () => {
  it("whether → argue; concept → teaches", () => {
    expect(assignmentPurposeLine("whether high schools should start later")).toBe("This assignment asks you to argue whether high schools should start later.");
    expect(assignmentPurposeLine("how the printing press changed politics")).toBe("This assignment asks you to explain how the printing press changed politics.");
    expect(assignmentPurposeLine("should schools start later")).toMatch(/^This is the question your paper answers/);
    expect(assignmentPurposeLine("the hero's journey")).toBe("This assignment teaches the hero's journey.");
    expect(read("components/stages/loop/coaching-loop.tsx")).not.toMatch(/This assignment teaches \$\{/);
  });
});

describe("presence tweaks", () => {
  it("one face on mobile: the header face hides below sm", () => {
    expect(read("components/stages/stage1/voice.tsx")).toMatch(/<PauFace alive className="hidden h-7 w-7 sm:block" \/>/);
  });
  it("lighter waves: thin strokes, centered partial width", () => {
    const p = read("components/stages/stage1/pau-presence.tsx");
    expect(p).toMatch(/inset-x-\[20%\]/);
    expect(p).toMatch(/strokeWidth="1"/);
    expect(p).not.toMatch(/strokeWidth="1\.5"/);
  });
  it("face: the locked character (blob head, pink cat-eye glasses, dark eyes, tiny smile)", async () => {
    const { PauFace, PAU_COLORS } = await import("@/components/stages/stage1/pau-presence");
    const html = renderToStaticMarkup(createElement(PauFace, {}));
    expect(html).toContain('data-pau-character="blob-glasses"');
    expect(html).toContain(PAU_COLORS.frame);
    expect(html).toContain(PAU_COLORS.head);
    expect((html.match(/r="0.9"/g) ?? []).length).toBe(2);
  });
});
