/** QA round 6 (after #70): filler folds into the answer, no looping "make it easier", reading help apart from the styles. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isFillerOnly, keepSubstance, pickEscalation } from "@/lib/stage1/north-turns";

const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
const OPTS = [
  { label: "Transformational", why: "Lets you show a leader selling a shared vision." },
  { label: "Situational", why: "Lets you show a leader shifting style." },
  { label: "Servant", why: "Lets you argue that putting people first carries a team." },
];

describe("SHOULD-FIX: 'ok' right behind a real answer is part of it", () => {
  it("filler-only messages are recognised; real ones aren't", () => {
    for (const t of ["ok", "Okay.", "hmm", "wait", "one sec", "ok\nhmm"]) expect(isFillerOnly(t), t).toBe(true);
    for (const t of ["My high school soccer coach, Mr. Alvarez", "yes", "Servant", "no"]) expect(isFillerOnly(t), t).toBe(false);
    expect(keepSubstance(["My high school soccer coach, Mr. Alvarez", "ok"])).toBe("My high school soccer coach, Mr. Alvarez");
  });
  it("within ~1 s of the real answer, or while its reply is pending, the filler folds in (its own bubble, no second reply)", () => {
    expect(intake).toContain("isFillerOnly(typedNow) && lastReal.current && !queuedRef.current && (submitting || sendLock.current || Date.now() - lastReal.current.at < 1500 || (lastReplyAt.current >= lastReal.current.at && Date.now() - lastReplyAt.current < 1000))");
    expect(intake).toContain("saidParts.current.set(key, [...partsOf(key), typedNow]);");
    expect(intake).toContain("lastReal.current = isFillerOnly(merged) ? null : { key: merged, at: enteredAt };");
  });
});

describe("MINOR: a 4th 'not sure' changes approach", () => {
  it("never the same ask three times: short, then an easy pick, then a different way in", () => {
    let last: string | null = null;
    const out: string[] = [];
    for (let round = 1; round <= 6; round++) {
      const e = pickEscalation({ options: OPTS, round, last });
      last = e.paras.join("\n");
      out.push(last);
    }
    expect(out[2]).toMatch(/Simplest way in: start with Transformational/);
    expect(out[3]).toMatch(/I'll pick one for you so we can keep moving: Transformational/);
    expect(out[3]).not.toMatch(/Want to start with/);
    expect(out[4]).toMatch(/different side/);
    expect(out[5]).toMatch(/Let's go with Transformational for now/);
    expect(out.filter((t) => /Want to start with Transformational\?/.test(t)).length).toBeLessThanOrEqual(2);
    for (const t of out) expect((t.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
  });
  it("the different way in hands their answer to the boss/coach/teacher path", () => {
    expect(intake).toContain("if (/^Let's come at it from a different side/.test(esc.paras[0] ?? \"\")) noLeaderAsked.current[q.id] = true;");
  });
});

describe("MINOR: reading help sits apart from the style chips", () => {
  it("its own labelled row under the styles", () => {
    const opt = intake.indexOf('aria-label="Options"');
    const help = intake.indexOf('aria-label="Reading help"');
    expect(opt).toBeGreaterThan(0);
    expect(help).toBeGreaterThan(opt);
    expect(intake).toContain("Before you pick, if it helps:");
    const optGroup = intake.slice(opt, intake.indexOf("</div>", opt));
    expect(optGroup).not.toContain("Catch me up on the reading first");
    expect(optGroup).not.toContain("Add a reading");
  });
});

describe("folded 'ok' and the spark trigger", () => {
  const hes = readFileSync("components/stages/stage1/hesitation.tsx", "utf8");
  it("a folded 'ok' stays on screen under the saved answer (and early take)", () => {
    expect(intake).toContain("{foldedAfter(said)}");
    expect(intake).toContain("{foldedAfter(stanceSent ?? stanceAnswer)}");
  });
  it("sending (the box emptying) is never a 'deleted most of it' hesitation", () => {
    expect(hes).toContain("resetRef.current !== resetKey");
    expect(intake).toContain("resetKey: `${qaAsides.length}:${answers.length}:${pendingSaid ?? \"\"}:${queuedSaid ?? \"\"}:${submitting ? 1 : 0}`");
  });
  it("spark questions are one Past chat line each", () => {
    expect(hes).toContain("<li key={q} data-chat-part>");
  });
});

