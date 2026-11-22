import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyRequirements, extractedField } from "@/lib/assignment/schema";
import { SUMMARY_OPENERS, openerIndex, pauPauSummaryBubbles } from "@/lib/stage1/pau-pau";
import { INTRO_BUBBLES, PLACEHOLDERS, moreWordsNote } from "@/lib/stage1/chat-copy";

const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
const bubbles = readFileSync("components/stages/stage1/chat-bubbles.tsx", "utf8");

function sheet() {
  const r = emptyRequirements();
  r.course = extractedField("ENG 101", 0.9);
  r.length = extractedField({ wordsMin: 1200, wordsMax: 1500 }, 0.9);
  r.citationStyle = extractedField("MLA 9" as const, 0.9);
  r.structuralRequirements = extractedField(["Clear thesis in the introduction", "Counterargument"], 0.9);
  r.requiredSources = extractedField({ countMin: 3, types: "scholarly sources" }, 0.9);
  r.rubricCriteria = extractedField([{ name: "Thesis" }, { name: "Evidence" }], 0.9);
  r.dueDate = extractedField("December 12, 2026", 0.9);
  r.topic = extractedField("Should high schools start later in the morning?", 0.9);
  return r;
}

describe("Stage 1 is one chat thread", () => {
  it("clears the box after send (and after a too-short message)", () => {
    const run = intake.slice(intake.indexOf("async function runParse"), intake.indexOf("function updateField"));
    expect(run.match(/setPaste\(""\)/g)?.length).toBe(2);
  });

  it("rebuilds the whole thread from saved data: first message, read-back, answers, story, stance", () => {
    expect(intake).toContain("SENT_FIELD_KEY");
    expect(intake).toContain("<StudentBubble message={sentMessage} />");
    expect(intake).toContain("<PauPauGroup bubbles={summary} />");
    expect(intake).toContain("coachingPlan.map((item, i) => {");
    expect(intake).toContain('editLabel="Change your story angle"');
    expect(intake).toContain('editLabel="Edit your early take"');
  });

  it("drops the form chrome but keeps its function", () => {
    expect(intake).not.toContain("counts toward your voice sample");
    expect(intake).not.toContain('"Quick question"');
    expect(intake).not.toContain("Skip get-to-know-you");
    expect(intake).not.toContain("Back to questions");
    expect(intake).not.toContain("Write or say it in your own words");
    expect(intake).toContain("Skip the get-to-know-you questions");
    expect(intake).toContain("Cancel edit");
    expect(intake).toContain("aria-label={`Voice sample: ${voiceEval.totalWords} of ${STAGE1_VOICE_MIN_WORDS} words`}");
    expect(moreWordsNote(12, 25, "Your early take")).toMatch(/^Give me a little more — a couple more sentences\?/);
  });

  it("every question has a placeholder in Pau Pau's voice; the voice sample is mentioned once", () => {
    for (const id of ["interest_1", "interest_2", "bg_comfort", "coaching_take", "personal_1", "fallback_voice", "stance_early"]) {
      expect(PLACEHOLDERS[id]).toBeTruthy();
    }
    expect(INTRO_BUBBLES.filter((b) => /how you write/.test(b))).toHaveLength(1);
  });

  it("keeps the composer above the keyboard and scrolls to the newest bubble", () => {
    expect(bubbles).toContain("window.visualViewport");
    expect(bubbles).toContain("sticky");
    expect(bubbles).toContain('scrollIntoView({ block: "end", behavior })');
  });

  it("the reading timer ticks from its own clock", () => {
    expect(bubbles).toContain("window.setInterval(() => setNow(Date.now()), 1000)");
    expect(intake).toContain("startedAt={parseStartedAt}");
  });
});

describe("read-back copy", () => {
  it("varies the opener by paper, stable for the same paper", () => {
    const seen = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "paper-1", "paper-2"].map((id) => openerIndex(id)));
    expect(seen.size).toBeGreaterThan(2);
    expect(openerIndex("paper-1")).toBe(openerIndex("paper-1"));
    const first = SUMMARY_OPENERS.map((_, i) => pauPauSummaryBubbles(sheet(), { seed: i })[0]);
    expect(new Set(first).size).toBe(SUMMARY_OPENERS.length);
    expect(first[2]).toBe("Alright, I read it. This is ENG 101: a 1,200–1,500 word paper in MLA format.");
  });

  it("splits into short bubbles, one idea each", () => {
    const parts = pauPauSummaryBubbles(sheet());
    expect(parts.length).toBeGreaterThanOrEqual(4);
    for (const part of parts) expect(part.split(/\s+/).length).toBeLessThanOrEqual(30);
  });
});
