import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isAmbiguousReply,
  isConfusedSaying,
  isUnsureReadSaying,
  isYesSaying,
  pickEscalation,
  refsUnreadMaterial,
  scrubUnreadRefs,
} from "@/lib/stage1/north-turns";
import { decisionQuestion, isLostSaying } from "@/lib/stage1/paper-context";

const OPTS = [
  { label: "Transformational leadership", why: "inspiring people toward a shared vision, like the leader in the HBR article" },
  { label: "Situational leadership", why: "changing your style to fit the team's readiness (Northouse ch 4)" },
  { label: "Servant leadership", why: "putting the team's growth first" },
  { label: "Behavioral approach", why: "task vs relationship behaviors" },
];
const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");

describe("QA 11:40 preview retest", () => {
  it("#1 typed not-read or unsure replies trigger the catch-up", () => {
    for (const t of ["I haven't read anything yet", "haven't read", "idk", "not sure", "no clue", "Not yet", "nope", "I skimmed it"]) {
      expect(isLostSaying(t) || isUnsureReadSaying(t), t).toBe(true);
    }
    for (const t of ["I've read it", "I read both. Goleman says emotional intelligence matters more than IQ for leaders"]) {
      expect(isUnsureReadSaying(t), t).toBe(false);
    }
    expect(intake).toContain("return isLostSaying(text) || isUnsureReadSaying(text);");
  });
  it("#1 ambiguous sure/ok gets a one-tap catch-up offer", () => {
    for (const t of ["sure", "ok", "Okay.", "yes please"]) expect(isAmbiguousReply(t), t).toBe(true);
    expect(isAmbiguousReply("I've read it")).toBe(false);
    expect(intake).toContain('q.id === "material_check" && isAmbiguousReply(typed)');
    expect(intake).toContain("Yes, catch me up");
  });
  it("#2 vague replies escalate to teach + recommend, never an identical repeat", () => {
    const seen: string[] = [];
    let last: string | null = null;
    for (let round = 1; round <= 5; round++) {
      const e = pickEscalation({ options: OPTS, round, last });
      const txt = e.paras.join("\n");
      expect(txt).not.toBe(last);
      seen.push(txt);
      last = txt;
      if (round >= 2) {
        expect(e.recommend).not.toBeNull();
        // Round 2 teaches the list; a later "make it easier" is short (QA round 5: no near-identical lists).
        if (round === 2) expect(txt).toMatch(/A lot of students in your spot start with .+ because/);
        else if (round === 3) expect(txt).toMatch(/Simplest way in: start with/);
        // QA round 6: then a change of approach, never the same ask a third time.
        else if (round === 4) expect(txt).toMatch(/I'll pick one for you so we can keep moving/);
        else expect(txt).toMatch(/different side/);
        if (round <= 3) expect(txt).toMatch(/yes or no/i);
        expect(e.paras.filter((p) => p.startsWith("•")).length).toBeLessThanOrEqual(3);
      }
    }
    expect(seen.filter((t) => /^Which one are you leaning toward/.test(t)).length).toBeLessThanOrEqual(1);
    expect(isYesSaying("sure")).toBe(true);
    expect(isYesSaying("yes because it fits Nadella")).toBe(true);
  });
  it("#3 explicit confusion is teach-then-ask at once", () => {
    expect(isConfusedSaying("no clue what a leader is supposed to do")).toBe(true);
    expect(isConfusedSaying("what's the difference")).toBe(true);
    const e = pickEscalation({ options: OPTS, round: 1, confused: true });
    expect(e.paras[0]).toMatch(/short version/);
    expect(e.recommend).not.toBeNull();
  });
  it("#4 nothing references unread material", () => {
    expect(refsUnreadMaterial("Who is the leader in the HBR article?")).toBe(true);
    const q = scrubUnreadRefs(decisionQuestion({ question: "Which style best fits the leader in the HBR article", options: OPTS, people: [], basis: "material" } as never));
    expect(refsUnreadMaterial(q), q).toBe(false);
    const e = pickEscalation({ options: OPTS, round: 2, unread: true });
    expect(refsUnreadMaterial(e.paras.join(" ")), e.paras.join(" ")).toBe(false);
    expect(intake).toContain("const clean = (t: string) => (unread ? scrubUnreadRefs(t) : t);");
  });
  it("Colton 11:41: no get-to-know questions and a locked composer", () => {
    expect(intake).toContain("if (!northstar && !skippedInterest && !prepared) {");
    expect(intake).toContain('if (!northstar && ((!getToKnowOff && !prepared) || has("personal_1"))) plan.push({');
    const composer = readFileSync("components/stages/stage1/chat-composer.tsx", "utf8");
    expect(composer).toContain("readOnly={false}");
    expect(composer).not.toMatch(/setQueued\(false\);\s*send\(\);/);
  });
});
