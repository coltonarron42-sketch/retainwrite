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
    expect(intake).toContain("confirmTurns.map((t, i) =>");
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
    expect(intake).toContain('<span className="sr-only">{`Voice sample: ${voiceEval.totalWords} of ${STAGE1_VOICE_MIN_WORDS} words`}</span>');
    expect(moreWordsNote(12, 25, "Your early take")).toMatch(/^Give me a little more — a couple more sentences\?/);
  });

  it("every question has a placeholder in Pau's voice; the voice sample is mentioned once", () => {
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
    expect(first[2]).toBe("Alright, I read it through. This is for ENG 101: a 1,200–1,500 word paper in MLA 9 format.");
  });

  it("splits into short bubbles, one idea each", () => {
    const parts = pauPauSummaryBubbles(sheet());
    expect(parts.length).toBeGreaterThanOrEqual(4);
    for (const part of parts) expect(part.split(/\s+/).length).toBeLessThanOrEqual(30);
  });
});

describe("opener spread", () => {
  it("random paper ids spread evenly over all openers", async () => {
    const { randomUUID } = await import("node:crypto");
    const counts = new Array(SUMMARY_OPENERS.length).fill(0);
    for (let i = 0; i < 4000; i++) counts[openerIndex(randomUUID())]++;
    const expected = 4000 / SUMMARY_OPENERS.length;
    for (const c of counts) expect(Math.abs(c - expected)).toBeLessThan(expected * 0.25);
    expect(SUMMARY_OPENERS.length).toBeGreaterThanOrEqual(8);
  });
  it("QA's four retest papers now get four different openers", () => {
    const qa = ["907d9e36-003c-4f45-b2b3-ad3ceee75b73", "ffb41414-6470-4e5e-b44c-1000a0325f09", "f3e92236-444d-4188-8e6c-36915e30c81a", "1352eb68-9314-4d71-9a19-8cbbfbdcef91"];
    expect(new Set(qa.map(openerIndex)).size).toBe(4);
  });
});

describe("step 3 leftovers", () => {
  const intakeSrc = () => readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
  it("story pick shows a neutral Picked chip, not a student-voice echo", () => {
    expect(intakeSrc()).toContain("<PickedChip");
    expect(intakeSrc()).toContain('storyAngle.source === "student" ?');
  });
  it("too-short answers are echoed as a student bubble", () => {
    expect(intakeSrc()).toContain("error && shortEcho ? <StudentBubble");
  });
  it("hides counts: a friendly nudge, never a word counter (QA 6:03 AM)", () => {
    const s = intakeSrc();
    expect(s).not.toMatch(/\$\{draftWords\} so far\)\.`/);
    expect(s).not.toContain("Voice sample ({voiceEval.totalWords}");
    expect(s).not.toContain("so far)");
    expect(s).toContain('shortNoteNudge("stance", draftWords)');
    expect(moreWordsNote(8, 25, "Your early take")).not.toMatch(/\d/);
  });
  it("no 'Send to Pau' label; Enter-to-send stays on (composer limits it to fine pointers)", () => {
    expect(intakeSrc()).not.toContain("Send to Pau");
    expect(intakeSrc()).not.toContain("enterSends={false}");
    expect(readFileSync("components/stages/stage1/chat-composer.tsx", "utf8")).toContain('matchMedia("(pointer: fine)")');
  });
});
