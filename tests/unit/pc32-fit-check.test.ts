import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { betterExamples, fitKey, fitPairForNote, fitPairFromContext, fitPairIn, fitReply, knownFit, parseFitVerdict } from "@/lib/stage2/fit-check";

const src = (p: string) => readFileSync(p, "utf8");
const words = (paras: string[]) => paras.join(" ").split(/\s+/).filter(Boolean).length;

describe("PC-32 FIT CHECK: style + leader (Colton t227u)", () => {
  it("finds the style and leader they named (both needed)", () => {
    expect(fitPairIn("I want to argue servant leadership using Sam Walton at Walmart")).toEqual({ style: "servant", leader: "Sam Walton" });
    expect(fitPairIn("Servant leadership, with Elon Musk as my example")).toEqual({ style: "servant", leader: "Elon Musk" });
    expect(fitPairIn("servant leadership because it puts people first")).toBeNull();
    // A name from the assignment sheet (the article's author) is never their leader.
    expect(fitPairIn("servant leadership like Daniel Goleman says", "Read 'What Makes a Leader?' by Daniel Goleman")).toBeNull();
    expect(fitKey({ style: "servant", leader: "Sam Walton" })).toBe(fitKey({ style: "Servant", leader: "sam walton" }));
  });

  it("strong pair (Walton + servant): one affirming line, no friction, no question", () => {
    const pair = fitPairIn("I'm going with servant leadership and Sam Walton")!;
    expect(knownFit(pair)).toBe("strong");
    const r = fitReply(pair, "strong");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatch(/Sam Walton and servant leadership is a solid pair/);
    expect(r[0]).toMatch(/well-documented support/);
    expect(r.join(" ")).not.toContain("?");
  });

  it("weak pair (Musk + servant): kind feedback, concept re-grounded first, 1-2 better fits, theirs to keep", () => {
    const pair = fitPairIn("Servant leadership, with Elon Musk as my example")!;
    expect(knownFit(pair)).toBe("weak");
    const r = fitReply(pair, "weak");
    expect(r).toHaveLength(3);
    expect(r[0]).toMatch(/I like that you've picked a real leader/);
    expect(r[0]).toMatch(/isn't usually held up as a servant leader/);
    // Re-grounds the concept in plain words, labelled general background (R2), before the suggestions.
    expect(r[1]).toMatch(/^In plain words \(general background\): servant leadership means/);
    expect(r[2]).toMatch(/Herb Kelleher/);
    expect(r[2]).toMatch(/Cheryl Bachelder/);
    expect(betterExamples(pair).length).toBeLessThanOrEqual(2);
    // Never overrules: theirs to keep.
    expect(r[2]).toMatch(/Keeping Elon Musk is completely your call/);
    // R1: no question from the fit lines (the step's own ask is the one question), no lecture.
    expect(r.join(" ")).not.toContain("?");
    expect(words(r)).toBeLessThan(110);
  });

  it("never suggests the leader they already named; unknown pairs say they're unsure (general background)", () => {
    expect(betterExamples({ style: "servant", leader: "Herb Kelleher" }).map((x) => x.name)).not.toContain("Herb Kelleher");
    expect(knownFit({ style: "servant", leader: "Mandy Lopez" })).toBeNull();
    const r = fitReply({ style: "servant", leader: "Mandy Lopez" }, "unsure");
    expect(r[0]).toMatch(/I'm not sure how well documented Mandy Lopez is as a servant leader, so take this as general background/);
    expect(r.join(" ")).not.toContain("?");
    expect(parseFitVerdict("nonsense")).toBe("unsure");
    expect(parseFitVerdict('{"verdict":"weak"}')).toBe("weak");
    expect(parseFitVerdict('{"verdict":"maybe"}')).toBe("unsure");
  });

  it("is wired after the note saves, once per pair, and never changes their note or returns the ghost", () => {
    const loop = src("components/stages/loop/coaching-loop.tsx");
    expect(loop.match(/void fitCheck\(note, section\.key\);/g)?.length).toBe(2);
    expect(loop).toContain("base0.events.includes(key)");
    const fn = loop.slice(loop.indexOf("async function fitCheck("), loop.indexOf("/** Which answer mode"));
    expect(fn).not.toMatch(/ideas:/);
    const route = src("app/api/papers/[paperId]/coach/fit/route.ts");
    expect(route).toContain("return NextResponse.json({ pair, verdict, paras });");
    expect(route).not.toMatch(/NextResponse\.json\([^)]*ghost/);
    expect(route).toContain("ghostLeakCheck");
    expect(route).toContain("assertCoachingOnly");
    expect(src("lib/stage2/fit-check.ts")).not.toMatch(/from "@\/lib\/(?:server\/)?ghost/);
  });
});

describe("PC-32 FIT CHECK fires on Stage 2 entry and on a changed pair (QA 4:57 PM)", () => {
  it("finds the pair they gave in Stage 1 (ideas or an older pick)", () => {
    expect(fitPairFromContext({ startingPoint: { ideas: "Elon Musk, servant leadership" } })).toEqual({ style: "servant", leader: "Elon Musk" });
    expect(fitPairFromContext({ startingPoint: { ideas: "Sam Walton at Walmart and how he served his people", followUp: "servant leadership mostly" } })).toEqual({ style: "servant", leader: "Sam Walton" });
    expect(fitPairFromContext({ decision: { pick: "Servant", answer: "Servant" }, leader: { pick: "Elon Musk", answer: "Elon Musk" } })).toEqual({ style: "servant", leader: "Elon Musk" });
    // A confirm phrase never feeds the pair; no style or no leader → no check.
    expect(fitPairFromContext({ startingPoint: { ideas: "Elon Musk", followUp: "Yes, that's right" } })).toBeNull();
    expect(fitPairFromContext({ startingPoint: { ideas: "servant leadership in general" } })).toBeNull();
    expect(fitPairFromContext(null)).toBeNull();
  });
  it("a later note that introduces or changes the pair is checked; a confirm phrase is not", () => {
    const known = { style: "servant", leader: "Elon Musk" };
    expect(fitPairForNote("Actually I'll switch to Herb Kelleher", known)).toEqual({ style: "servant", leader: "Herb Kelleher" });
    expect(fitPairForNote("maybe transformational fits him better", known)).toEqual({ style: "transformational", leader: "Elon Musk" });
    expect(fitPairForNote("Yes, that's right", known)).toBeNull();
    expect(fitPairForNote("he really listens to the team", known)).toBeNull();
    expect(fitKey(fitPairForNote("Elon Musk and servant leadership", known)!)).toBe(fitKey(known));
  });
  it("runs once on entry, inline with the opener before the Intro, and the server keeps each result (reload-safe)", () => {
    const loop = src("components/stages/loop/coaching-loop.tsx");
    expect(loop).toContain("if (live && d?.ok && stage === 2) await entryFitCheck(d, () => live);");
    expect(loop).toContain("fit: entryFit,");
    const chat = src("components/stages/loop/stance-chat.tsx");
    expect(chat).toMatch(/\.\.\.\(intro\.earlier \? \[intro\.earlier\] : \[\]\),\n\s+\.\.\.\(intro\.fit \?\? \[\]\),/);
    const route = src("app/api/papers/[paperId]/coach/fit/route.ts");
    expect(route).toContain('const FIT_FIELD = "server:fit_checks";');
    expect(route).toContain("cached: true");
  });
});
