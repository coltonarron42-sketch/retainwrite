import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diagnoseQuestion, informedAffirm, informedSaying, lostLead, namedPerson, pickEscalation } from "@/lib/stage1/north-turns";

const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");

describe("Colton 12:08: diagnose first, then branch", () => {
  it("the first question restates the ask in plain words and asks where they are", () => {
    const q = diagnoseQuestion("argue which leadership style works best for leading a team through change, using one real leader");
    expect(q).toMatch(/^So, in plain words: Argue which leadership style/);
    expect(q).toMatch(/Where are you with it\?/);
    expect(q).toMatch(/read the course material/);
    expect(intake).toContain("diagnoseQuestion(brief?.readback?.ask ?? requirements.promptQuestion.value)");
  });
  it("INFORMED: ideas with a leader are locked in word for word, any paper", () => {
    const t = "I want Sam Walton, I think he shows servant and transformational styles, I just want to hit every requirement";
    expect(namedPerson(t)).toBe("Sam Walton");
    expect(informedSaying(t)).toEqual({ stance: t, leader: "Sam Walton" });
    const psy = "I want to argue stress hurts memory, using my finals week last spring when I blanked on a test I had studied for";
    expect(informedSaying(psy)?.stance).toBe(psy);
    for (const lost of ["no clue what a leader is supposed to do", "idk", "sure", "I haven't read it yet"]) expect(informedSaying(lost), lost).toBeNull();
    const a = informedAffirm(t).join(" ");
    expect(a).toMatch(/Awesome, sounds like you have a good idea of what this paper needs/);
    expect(a).toContain(t.replace(/[“”"]/g, "'"));
    expect(a).toMatch(/expand on it later/);
    expect(intake).toContain('if (stated && has("decision_why")) {');
    expect(intake).toContain("Next, the assignment needs your actual case.");
  });
  it("LOST: reassure, teach the core idea, then the professor's sources", () => {
    const l = lostLead({ concept: "Leaders move people or organizations toward a larger goal, and they do it with different styles.", ask: "x" });
    expect(l).toMatch(/^That's okay, that's why you're here! Leaders move people/);
    expect(l).toMatch(/summary of the key ideas from your professor's sources/);
    expect(lostLead({ ask: "argue whether stress helps or hurts memory" })).toMatch(/The core of it: argue whether stress/);
    expect(lostLead({ ask: "x", hasSummary: false })).toMatch(/I don't have your professor's sources yet/);
    const e = pickEscalation({
      options: [{ label: "Transformational", why: "vision" }, { label: "Servant", why: "people first" }],
      people: [{ label: "Satya Nadella", why: "changed Microsoft's culture" }, { label: "Mary Barra", why: "steered GM through a recall" }],
      round: 1,
      confused: true,
      concept: "Leaders move people toward a larger goal.",
    });
    const txt = e.paras.join(" ");
    expect(txt).toMatch(/That's okay, that's why you're here! Leaders move people/);
    expect(txt).toMatch(/Leaders people often write about here: .*Mary Barra/);
  });
});
