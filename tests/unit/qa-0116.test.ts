import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { informedAffirm, informedNext, pickEscalation, stylesIn } from "@/lib/stage1/north-turns";
import { assignmentDecisionAsk } from "@/lib/stage1/paper-context";
import { buildStoryAngleFallback } from "@/lib/stage1/story-angles";

const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
const MID = /\b(through|of|for|with|about|to|in|on|at|by|from|the|a|and)\s+(say|do|think|be)\?/i;

describe("QA 1:16: the informed branch uses what the student said", () => {
  const t = "I want to use Sam Walton. I think he shows servant and transformational leadership, I just want to make sure I hit every requirement.";
  it("affirms by name, locks both styles in, shows the checklist", () => {
    expect(stylesIn(t).map((x) => x.toLowerCase())).toEqual(["servant", "transformational"]);
    const a = informedAffirm(t, { leader: "Sam Walton", mustInclude: ["APA citations", "One real leader as the example"], needsPerson: true }).join("\n");
    expect(a).toMatch(/Sam Walton/);
    expect(a).toMatch(/servant/i);
    expect(a).toMatch(/transformational/i);
    expect(a).toMatch(/Locked in, in your words/);
    expect(a).toMatch(/checklist/);
    expect(a).toMatch(/✓/);
    expect(a).toMatch(/○/);
    expect(a).not.toMatch(/Here are a few directions/);
  });
  it("the next step is one concrete question that ends at a sentence boundary", () => {
    const n = informedNext(t, "Sam Walton");
    expect(n).toMatch(/Sam Walton/);
    expect((n.match(/\?/g) ?? []).length).toBe(1);
    expect(n).not.toMatch(MID);
  });
  it("story cards are skipped while the stated decision is saving", () => {
    expect(intake).toContain('informedSaying(said("material_check")');
  });
});

describe("QA 1:16: the lost recommendation stays stable", () => {
  it("same recIndex gives the same pick; it only moves on a no", () => {
    const options = [{ id: "a", label: "Transformational" }, { id: "b", label: "Situational" }, { id: "c", label: "Servant" }] as never;
    const a = pickEscalation({ round: 2, options, recIndex: 0 } as never);
    const b = pickEscalation({ round: 3, options, recIndex: 0 } as never);
    expect(JSON.stringify(a)).toMatch(/Transformational/);
    // QA ethos (after #77): style turns 2 and 3 are neutral (no recommendation); leaders keep theirs.
    expect(JSON.stringify(b)).not.toMatch(/start with Transformational/i);
    expect(b.recommend).toBeNull();
    expect(intake).toContain("recIndex: recNos.current[q.id] ?? 0");
  });
});

describe("QA 1:16: PSY lost follow-up is concrete; no clipped clauses", () => {
  it("a whether-or prompt gives a concrete gut-check question", () => {
    const q = assignmentDecisionAsk("write 800-1,000 words on whether stress helps or hurts memory, with one example from your own life.");
    expect(q).toBe("Gut answer first, even a guess: stress helps or hurts memory? Pick one and give one reason. A sentence is plenty.");
    expect(intake).not.toContain("What's the first big choice you'd make");
  });
  it("fallback angles never embed a clipped assignment clause", () => {
    const angles = buildStoryAngleFallback({ topic: "which leadership style is most effective for leading a team through change", studentPhrases: [] });
    for (const a of angles) expect(a.question, a.question).not.toMatch(MID);
    expect(angles.map((a) => a.question).join(" ")).not.toMatch(/leading a team through/);
  });
});

describe("QA 1:16: composer never drops a message", () => {
  const composer = readFileSync("components/stages/stage1/chat-composer.tsx", "utf8");
  it("rapid different sends merge into one turn; a turned-back send restores the text", () => {
    expect(intake).toContain("coalesce.current.text += `\\n${typedNow}`");
    expect(intake).toContain("setDraftAnswer((d) => (d.trim() ? (d.includes(text) ? d : `${text}\\n${d}`) : text))");
    expect(intake).toContain("data-pending-said");
    expect(composer).not.toContain("cursor-not-allowed opacity-60\" : \"\"}");
  });
});

describe("QA 1:16: a short informed pick gets one concrete story question, never cards", () => {
  it("story ask names their leader; the early take afterwards is a different question", async () => {
    const { informedStoryAsk } = await import("@/lib/stage1/north-turns");
    const s = informedStoryAsk("Satya Nadella");
    expect(s).toMatch(/When did Satya Nadella have to lead people through a big change/);
    expect((s.match(/\?/g) ?? []).length).toBe(1);
    const n = informedNext("I want to argue transformational leadership, using Satya Nadella", "Satya Nadella", true);
    expect(n).toMatch(/^Now your case: how did transformational leadership show up in that moment/);
    expect(intake).toContain('screen === "story" && informedStory');
  });
});
