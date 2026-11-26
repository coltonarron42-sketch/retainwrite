import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keepShownTitles, projectSkeleton, ruleOutline, shapeFromModel, shapeSigOf, type ShapeOutline } from "@/lib/skeleton/shape";
import { bodyPlan, chosenStyles, directionSummary, fitBodies, reasonClause, statedBodies, varyTitles } from "@/lib/skeleton/tidy";
import { pickedStyles } from "@/lib/stage1/paper-context";

const SHEET = "BUS 210 Leadership essay for Prof. Kim. Using Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice) and the assigned HBR article 'What Makes a Leader?' by Daniel Goleman, write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7. Due Dec 10.";
// The 5-body model shape QA saw on 8e10b2f3.
const FIVE = shapeFromModel({ body: [{ focus: "northouse style approach defined" }, { focus: "goleman's emotional intelligence link" }, { focus: "the leader's change story" }, { focus: "style in action through change" }, { focus: "counterargument and reply" }] })!;
const bodies = <B extends { group: string }>(s: { blocks: B[] }): B[] => s.blocks.filter((b) => b.group === "body");

describe("QA (after #82) b: body count sized to the paper", () => {
  it("1,200-1,500 words: 3 bodies, or 4 with a counterargument", () => {
    expect(bodyPlan({ text: SHEET, words: 1500 })).toEqual({ bodies: 3, withCounter: 4, stated: false });
    const fit = fitBodies(FIVE, bodyPlan({ text: SHEET, words: 1500 }));
    expect(bodies(fit).map((b) => `${b.key} ${b.sub}`)).toEqual([
      "body-1 northouse style approach defined",
      "body-2 goleman's emotional intelligence link",
      "body-3 the leader's change story",
      "body-4 counterargument and reply",
    ]);
  });
  it("no counterargument paragraph: 3", () => {
    const s = shapeFromModel({ body: [{ focus: "a" + "bc frame" }, { focus: "the leader's change story" }, { focus: "style in action" }, { focus: "evidence it worked" }, { focus: "tie it to the readings" }] })!;
    expect(bodies(fitBodies(s, bodyPlan({ text: SHEET }))).length).toBe(3);
  });
  it("other lengths", () => {
    expect(bodyPlan({ text: "Write 800 words." }).bodies).toBe(2);
    expect(bodyPlan({ text: "Write a 2,500-3,000 word paper." })).toEqual({ bodies: 7, withCounter: 8, stated: false });
    expect(bodyPlan({ text: "4-5 pages" }).bodies).toBe(3);
    expect(bodyPlan({ text: "", words: null })).toEqual({ bodies: 3, withCounter: 3, stated: false });
  });
  it("a paragraph count the assignment states wins", () => {
    expect(statedBodies("Write a five-paragraph essay on…")).toBe(3);
    expect(statedBodies("Include 4 body paragraphs.")).toBe(4);
    expect(statedBodies("Answer in 6 paragraphs.")).toBe(4);
    expect(statedBodies(SHEET)).toBeNull();
    const plan = bodyPlan({ text: `${SHEET} Use exactly two body paragraphs.` });
    expect(plan).toEqual({ bodies: 2, withCounter: 2, stated: true });
    expect(bodies(fitBodies(FIVE, plan)).map((b) => b.sub)).toEqual(["northouse style approach defined", "counterargument and reply"]);
    const padded = fitBodies(shapeFromModel({ body: [{ focus: "one" + " thing" }, { focus: "two things" }] })!, bodyPlan({ text: "Include 4 body paragraphs." }));
    expect(bodies(padded).map((b) => b.key)).toEqual(["body-1", "body-2", "body-3", "body-4"]);
  });
  it("the shape prompt asks for the planned count; every served shape is fitted", () => {
    const ghost = readFileSync("lib/server/skeleton/ghost.ts", "utf8");
    expect(ghost).toContain("target_bodies: plan.bodies, target_bodies_with_counter: plan.withCounter");
    expect(ghost).toContain("fitBodies(await ensureShapeRaw(input), plan, readings)");
  });
});

describe("QA (after #82) 1: titles always belong to the current shape", () => {
  const facts = { leader: "Sam Walton", styles: ["servant"] };
  it("titles made for another shape are not served (no shift, no Body 6)", () => {
    const old: ShapeOutline = { v: 1, source: "model", titles: ["Sam Walton, servant leadership", "goleman's emotional intelligence link", "Sam Walton, style most effective for change", "Sam Walton, the leader's change story", "tie example to both readings", "counterargument and reply"].map((title, i) => ({ key: `body-${i + 1}`, title, ideaRefs: [], fixed: true })) };
    const fit = fitBodies(FIVE, bodyPlan({ text: SHEET }));
    const v = projectSkeleton(fit, old);
    expect(bodies(v).every((b) => (b as unknown as { title: string | null }).title === null)).toBe(true);
    expect(v.blocks.some((b) => b.key === "body-6")).toBe(false);
  });
  it("a rebuilt shape re-titles: shown titles from the old shape never carry over", () => {
    const fit = fitBodies(FIVE, bodyPlan({ text: SHEET }));
    const shownOld = { ...ruleOutline(FIVE, facts), titles: ruleOutline(FIVE, facts).titles.map((t, i) => ({ ...t, title: `old ${i + 1} title` })) };
    const next = keepShownTitles(shownOld, ruleOutline(fit, facts), "fk", shapeSigOf(fit));
    expect(next.titles.map((t) => t.title).some((t) => /^old /.test(t))).toBe(false);
    expect(next.shapeSig).toBe(shapeSigOf(fit));
    expect(next.titles.map((t) => t.key)).toEqual(bodies(fit).map((b) => b.key));
    const v = projectSkeleton(fit, next);
    expect(bodies(v).map((b) => b.key)).toEqual(["body-1", "body-2", "body-3", "body-4"]);
  });
  it("same shape: shown titles stay (the 3:26 AM rule), index-aligned, extras dropped", () => {
    const fit = fitBodies(FIVE, bodyPlan({ text: SHEET }));
    const sig = shapeSigOf(fit);
    const shown = { ...ruleOutline(fit, facts), titles: [...ruleOutline(fit, facts).titles, { key: "body-9", title: "extra", ideaRefs: [], fixed: true }] };
    const next = keepShownTitles(shown, ruleOutline(fit, facts), "fk", sig);
    expect(next.titles.map((t) => t.key)).toEqual(["body-1", "body-2", "body-3", "body-4"]);
  });
  it("the route regenerates stale titles", () => {
    const route = readFileSync("app/api/papers/[paperId]/skeleton/route.ts", "utf8");
    expect(route).toContain("const stale = Boolean(outline && outline.shapeSig !== shapeSigOf(shape));");
    expect(route).toContain('shown: stale ? null : (existing?.outline ?? null)');
  });
});

describe("QA (after #82) c: the leader's name on at most two titles", () => {
  it("varies the rest", () => {
    const fit = fitBodies(FIVE, bodyPlan({ text: SHEET }));
    const outline: ShapeOutline = { v: 1, source: "model", shapeSig: shapeSigOf(fit), titles: ["Sam Walton, servant leadership", "Sam Walton, Goleman's emotional intelligence", "Sam Walton, the leader's change story", "Sam Walton, counterargument and reply"].map((title, i) => ({ key: `body-${i + 1}`, title, ideaRefs: [] })) };
    const v = varyTitles(projectSkeleton(fit, outline), "Sam Walton");
    const titles = bodies(v).map((b) => (b as unknown as { title: string | null }).title);
    expect(titles).toEqual(["Sam Walton, servant leadership", "Sam Walton, Goleman's emotional intelligence", "The leader's change story", "Counterargument and reply"]);
    expect(titles.filter((t) => t?.includes("Sam Walton")).length).toBeLessThanOrEqual(2);
  });
});

describe("QA (after #82) a: the top line is a synthesized summary", () => {
  it("QA's sentence becomes a tidy line (no raw quote, no thesis)", () => {
    const said = "I like servant, not transformational, because he put associates first.";
    const s = directionSummary({ leader: "Sam Walton", styles: ["Servant"], said });
    expect(s).toBe("Sam Walton as a servant leader: he put associates first");
    expect(s).not.toContain(said);
    expect(s).not.toMatch(/\b(?:I|I like|not transformational|is the most effective|works best)\b/);
  });
  it("graceful when parts are missing", () => {
    expect(directionSummary({ leader: "Satya Nadella", styles: ["transformational"], said: "I want to argue transformational leadership, using Satya Nadella at Microsoft." })).toBe("Satya Nadella as a transformational leader");
    expect(directionSummary({ leader: null, styles: ["servant", "transformational"], said: null })).toBe("Servant and transformational leadership");
    expect(directionSummary({ leader: "Sam Walton", styles: [], said: "" })).toBe("Sam Walton as your example");
    expect(directionSummary({ leader: null, styles: [], said: "something" })).toBeNull();
    expect(directionSummary({ leader: "Mary Barra", styles: ["authentic"], said: "authentic because" })).toBe("Mary Barra as an authentic leader");
  });
  it("a reason is tidied, short, and never a first-person plan", () => {
    expect(reasonClause("Servant because I think he really listened to his associates and that's why")).toBe("he listened to his associates");
    expect(reasonClause("because I want to show the change")).toBeNull();
    expect(reasonClause("no reason given")).toBeNull();
  });
  it("the dock shows the summary, never the raw Stage 1 answer", () => {
    const dock = readFileSync("components/skeleton/skeleton-dock.tsx", "utf8");
    expect(dock).toContain("direction={view?.summary ?? null}");
    expect(dock).not.toContain("shortDirection(live?.direction)");
  });
});

describe("QA (after #82) walk: titles match their paragraph", () => {
  const ANSWER = "I read both. Goleman says emotional intelligence matters more than IQ for leaders; Northouse ch 4 covers the behavioral approach, task vs relationship. I want to argue transformational leadership, using Satya Nadella at Microsoft. Because he got a huge company to change by inspiring people with a clear vision instead of ordering them around.";
  it("a style named only while describing a reading isn't their choice", () => {
    const all = pickedStyles({ pick: "Transformational", answer: ANSWER });
    expect(all.map((x) => x.toLowerCase())).toContain("behavioral");
    expect(chosenStyles(all, ANSWER, "Transformational").map((x) => x.toLowerCase())).toEqual(["transformational"]);
    expect(chosenStyles(["Servant", "Transformational"], "I want servant and transformational together.", null)).toEqual(["Servant", "Transformational"]);
    expect(chosenStyles(["Servant"], ANSWER, null)).toEqual(["Servant"]);
    expect(directionSummary({ leader: "Satya Nadella", styles: chosenStyles(all, ANSWER, "Transformational"), said: ANSWER })).toMatch(/^Satya Nadella as a transformational leader: he got a huge company to change/);
  });
  it("the style title lands on the leader's paragraph, not the Northouse one", () => {
    const fit = fitBodies(FIVE, bodyPlan({ text: SHEET }));
    const titles = ruleOutline(fit, { leader: "Satya Nadella", styles: ["transformational"] }).titles.map((t) => `${t.key} ${t.title}`);
    expect(titles[0]).not.toMatch(/transformational/i);
    expect(titles[0]).toMatch(/northouse/i);
    expect(titles[2]).toMatch(/^body-3 Satya Nadella, transformational leadership$/);
    const v = varyTitles(projectSkeleton(fit, ruleOutline(fit, { leader: "Satya Nadella", styles: ["transformational"] })), "Satya Nadella");
    for (const b of bodies(v)) { const t = (b as unknown as { title: string | null }).title; if (t) expect(t.charAt(0)).toBe(t.charAt(0).toUpperCase()); }
  });
  it("the route and the titler use the chosen styles", () => {
    expect(readFileSync("app/api/papers/[paperId]/skeleton/route.ts", "utf8")).toContain("chosenStyles(pickedStyles(pctx?.decision");
    expect(readFileSync("lib/skeleton/shape.ts", "utf8")).toContain("Each title names what THAT paragraph is about");
  });
});
