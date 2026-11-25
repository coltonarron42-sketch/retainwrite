import { describe, expect, it } from "vitest";
import { displaySectionTitle, paperSections, pendingSectionHref, pendingSectionStorageKey, readPendingSection, shapedTitle, withoutSectionQuery } from "@/lib/skeleton/sections";
import { projectSkeleton, ruleShape, type SkeletonView } from "@/lib/skeleton/shape";
import { conceptTeachCard, guardTeachCard } from "@/lib/coaching/teach";
import { outlineAsk, outlineIntroLine, OUTLINE_INTRO } from "@/components/stages/loop/outline-chat";
import { pickPhrase } from "@/lib/stage1/paper-context";

const intro = { key: "intro", title: "Introduction", needs: "Introduce the work", ideas: ["My hook"] };

describe("PC-30 follow-up: section title capitalization", () => {
  it("starts with a capital and keeps known acronyms uppercase", () => {
    expect(displaySectionTitle("Goleman ei and change")).toBe("Goleman EI and change");
    expect(displaySectionTitle("counterargument and reply")).toBe("Counterargument and reply");
    expect(displaySectionTitle("goleman EI and change")).toBe("Goleman EI and change");
    expect(displaySectionTitle("Servant leadership in daily decisions")).toBe("Servant leadership in daily decisions");
  });
  it("applies to ghost #2 titles and stand-in subheadings", () => {
    const v: SkeletonView = projectSkeleton(ruleShape({ text: "Explain which leadership style works best.", words: 800 }), null);
    v.blocks[1]!.title = "goleman ei and change";
    v.blocks[2]!.title = "counterargument and reply";
    const rows = paperSections({ view: v, words: {} });
    expect(shapedTitle(v.blocks[1]!, 0).title).toBe("Goleman EI and change");
    expect(rows[1]).toMatchObject({ kicker: "Body Paragraph 1", title: "Goleman EI and change" });
    expect(rows[2]).toMatchObject({ kicker: "Body Paragraph 2", title: "Counterargument and reply" });
  });
});

describe("PC-30 follow-up: ?section is stripped from the URL immediately", () => {
  it("drops the section param and keeps the rest of the query and hash", () => {
    expect(withoutSectionQuery("/app/papers/p1/stage/3?section=intro&screen=outline")).toBe("/app/papers/p1/stage/3?screen=outline");
    expect(withoutSectionQuery("/app/papers/p1/stage/3?section=body")).toBe("/app/papers/p1/stage/3");
    expect(withoutSectionQuery("https://retainwrite.vercel.app/app/papers/p1/stage/2?section=body#top")).toBe("/app/papers/p1/stage/2#top");
    expect(withoutSectionQuery("/app/papers/p1/stage/3?screen=outline")).toBe("/app/papers/p1/stage/3?screen=outline");
  });
  it("keeps the key after the URL is cleared, so a remount can still open the section", () => {
    const first = pendingSectionHref("/app/papers/p1/stage/3?section=intro&screen=outline");
    expect(first).toEqual({ key: "intro", next: "/app/papers/p1/stage/3?screen=outline" });
    expect(readPendingSection("p1", first.next, first.key)).toBe("intro");
    expect(readPendingSection("p1", first.next, null)).toBeNull();
    expect(pendingSectionStorageKey("p1")).toBe("rw:skeleton-section:p1");
  });
});

describe("PC-30 follow-up: Stage 3 opener names saved styles and leader", () => {
  const pick = pickPhrase({ pick: "Transformational", answer: "servant and transformational" });
  it("names both styles and the leader when they were saved", () => {
    const line = outlineIntroLine(pick, "Sam Walton");
    expect(line).toContain("servant and transformational leadership");
    expect(line).toContain("Sam Walton");
    expect(line).toMatch(/^I pulled in your notes from Stance\./);
    expect(line).toContain("We'll shape one section at a time");
  });
  it("names only what was saved, and never invents a leader or style", () => {
    expect(outlineIntroLine(pick, null)).toContain("You picked servant and transformational leadership.");
    expect(outlineIntroLine(pick, null)).not.toMatch(/as your leader|as your example/);
    expect(outlineIntroLine(null, "Sam Walton")).toContain("using Sam Walton as your example");
    expect(outlineIntroLine(null, "Sam Walton")).not.toMatch(/You picked/);
    expect(outlineIntroLine(null, null)).toBe(OUTLINE_INTRO);
    expect(outlineIntroLine("", "")).toBe(OUTLINE_INTRO);
  });
  it("is the first paragraph of the first Stage 3 ask", () => {
    const paras = outlineAsk(intro, true, false, null, null, pick, "Sam Walton");
    expect(paras[0]).toBe(outlineIntroLine(pick, "Sam Walton"));
    expect(outlineAsk(intro, false)[0]).not.toBe(OUTLINE_INTRO);
  });
});

describe("PC-30 follow-up: Body quick lesson covers every chosen style", () => {
  it("two styles: concept, definition, and guard all name both", () => {
    const card = conceptTeachCard({
      decision: { pick: "Transformational", answer: "I'd pick servant AND transformational because Walton put associates first" },
      leader: { pick: "Sam Walton" },
    }, "r")!;
    expect(guardTeachCard(card).ok).toBe(true);
    expect(card.concept).toBe("servant and transformational leadership");
    expect(card.definition.toLowerCase()).toMatch(/servant leadership/);
    expect(card.definition.toLowerCase()).toMatch(/transformational leadership/);
    expect(card.qualities.length).toBeGreaterThanOrEqual(3);
    expect(card.showsUpAs.length).toBeGreaterThanOrEqual(2);
  });
  it("three styles stay under the lesson limits", () => {
    const card = conceptTeachCard({
      decision: { pick: "Servant", answer: "servant, transformational and situational, since he adapted" },
    }, "r")!;
    expect(guardTeachCard(card).ok).toBe(true);
    expect(card.concept).toBe("servant, transformational and situational leadership");
    expect(card.definition.toLowerCase()).toMatch(/servant/);
    expect(card.definition.toLowerCase()).toMatch(/transformational/);
    expect(card.definition.toLowerCase()).toMatch(/situational/);
  });
});
