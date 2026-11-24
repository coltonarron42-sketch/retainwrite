import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lostOffer, requirementLines } from "@/lib/stage1/north-turns";
import { PAU_PAU_ASK_TEXT, SOURCES_MARKER, askWasMade, sourcesAskText } from "@/lib/stage1/pau-pau";
import { summaryParas } from "@/lib/stage1/paper-context";
import { materialGateLabel } from "@/lib/stage1/intake-resume";

const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");

describe("Colton 1:54 R1: lost gets an offer, then a direction", () => {
  it("offers a short plain summary tied to the assignment", () => {
    expect(lostOffer("argue which leadership style works best for leading a team through change")).toBe(
      "That's okay, that's why you're here! Want me to summarize the main leadership styles in plain words? It's short, and then we'll go straight to picking your direction.",
    );
    expect(lostOffer("write about whether stress helps or hurts memory")).toMatch(/the key ideas you need for this paper/);
    expect(intake).toContain("lostOffer(brief?.readback?.ask");
    expect(intake).toContain("data-catchup-no");
  });
  it("a declined catch-up reads as passed on the gate", () => {
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: [], materialAnswer: "No thanks, skip the summary. Let's pick a direction." })).toBe("Material: you passed on the catch-up");
  });
  it("a personal moment they gave is checked off", () => {
    const l = requirementLines("I want to argue stress hurts memory, using my finals week last spring", { leader: null, styles: [], mustInclude: ["one example from your own life"] });
    expect(l.join("\n")).toMatch(/✓ one example from your own life: you've got one/);
    expect(l.join("\n")).toMatch(/✓ Your position, in your words/);
  });
});

describe("Colton 1:54 R2: named material is asked for first; fallback is labeled general background", () => {
  it("names the chapter and asks for photos, a PDF or the pages", () => {
    const t = sourcesAskText(["Chapter 4 of Northouse, Leadership: Theory and Practice"]);
    expect(t).toMatch(/^It mentions .*Northouse.*\. Can you upload photos, a PDF, or the relevant pages\? Best summaries come from the exact material your professor is using\.$/);
    expect(askWasMade(t, "sources")).toBe(true);
    expect(PAU_PAU_ASK_TEXT.sources.endsWith(SOURCES_MARKER)).toBe(true);
  });
  it("a summary without their copy says so plainly and is labeled general background", () => {
    const [lead] = summaryParas({ kind: "knowledge", title: "Memory Under Pressure", points: ["x"] } as never);
    expect(lead).toMatch(/^I don't have your copy of Memory Under Pressure, so this is general background/);
  });
});

describe("Colton 1:54 R4: no proven learning claims anywhere in the app copy", () => {
  const BANNED = /score higher|proven to improve retention|you'?ll know it on test day/i;
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mdx?)$/.test(f) ? [p] : [];
    });
  it("app, components and lib never say a banned phrase", () => {
    const hits = ["app", "components", "lib"].flatMap(walk).filter((p) => BANNED.test(readFileSync(p, "utf8")));
    expect(hits).toEqual([]);
  });
});

describe("Colton 1:54 R2: a reading named only on the sheet is asked for", () => {
  it("course-packet article by an initial-only author reads cleanly", () => {
    expect(sourcesAskText(["Memory Under Pressure by L"])).toMatch(/^It mentions “Memory Under Pressure”\. Can you upload photos/);
  });
});

describe("QA 1:16 PSY: bare yes/no options become the two real sides", async () => {
  const { decisionQuestion } = await import("@/lib/stage1/paper-context");
  it("stress helps memory / stress hurts memory", () => {
    const q = decisionQuestion(
      { question: "Where do you stand on the assignment's question so far", options: [{ label: "Yes", why: "a" }, { label: "No", why: "b" }], people: [] } as never,
      { ask: "write 800-1,000 words on whether stress helps or hurts memory, using one example from your own life" },
    );
    expect(q).toMatch(/^Gut answer first, even a guess: stress helps memory or stress hurts memory\? Here are a few real options: 1\) Stress helps memory/);
  });
});
