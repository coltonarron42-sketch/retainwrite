import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { draftGuard } from "@/lib/ai/draftGuard";
import { CONNECTORS, connectorWordCount } from "@/lib/coaching/connectors";
import { assertNoHiddenDraftLeak } from "@/lib/drafting/leak";
import { shapeReadback } from "@/lib/drafting/readback";
import { nextDraftScreen } from "@/lib/drafting/screen";
import { buildSkeleton, skeletonHasOnlyStudentText } from "@/lib/skeleton/build";
import { variantForGenre, variantFromPromptType } from "@/lib/drafting/variants";

describe("drafting coach limits", () => {
  it("rejects pasteable sentences and keeps questions", () => {
    const topic = ["servant", "leadership", "legere"];
    expect(
      draftGuard({
        text: "Servant leadership puts employees first.",
        topicStems: topic,
        studentText: "I am writing about listening.",
      }).ok,
    ).toBe(false);
    expect(
      draftGuard({
        text: "It started with Legere's arrival at T-Mobile.",
        topicStems: topic,
        studentText: "listening",
      }),
    ).toMatchObject({ ok: false, rule: "D6" });
    expect(
      draftGuard({
        text: "Does sentence 2 explain why this example fits the style?",
        topicStems: topic,
        studentText: "I wrote about a style.",
      }).ok,
    ).toBe(true);
    expect(
      draftGuard({
        text: "Your so what could be that the trip changed you.",
        topicStems: topic,
        studentText: "the trip",
      }),
    ).toMatchObject({ ok: false, rule: "D4" });
  });

  it("keeps connector chips short and slot-free", () => {
    for (const phrases of Object.values(CONNECTORS)) {
      for (const phrase of phrases) {
        expect(connectorWordCount(phrase)).toBeLessThanOrEqual(4);
        expect(phrase).not.toMatch(/\[|___/);
      }
    }
    const app = readFileSync("lib/coaching/connectors.ts", "utf8");
    expect(app).not.toMatch(/We started with/);
    expect(readFileSync("lib/coaching/paragraphShapes.ts", "utf8")).not.toMatch(/\[ \]|___/);
  });

  it("routes intro variants and moves the screen machine", () => {
    expect(variantForGenre("personal_experience")).toBe("story");
    expect(variantForGenre("unknown")).toBe("thesis");
    expect(variantFromPromptType("lesson")).toBe("thesis");
    expect(nextDraftScreen("zoomed_in", "section_saved")).toBe("milestone");
    expect(nextDraftScreen("milestone", "review")).toBe("review_all");
    expect(nextDraftScreen("review_all", "jump")).toBe("jump_edit");
    expect(nextDraftScreen("jump_edit", "back")).toBe("zoomed_in");
    expect(nextDraftScreen("zoomed_in", "conclusion_saved")).toBe("payoff");
  });

  it("builds a skeleton from the student's own rows and blocks a hidden-draft leak", () => {
    const blocks = buildSkeleton([
      { key: "intro", title: "Introduction", notes: ["a coach who listened"], sentences: ["I started with the coach."] },
    ]);
    expect(
      skeletonHasOnlyStudentText(blocks, ["a coach who listened", "I started with the coach."]),
    ).toBe(true);
    const hidden = "The secret answer key sentence about shuttle buses at dawn stays private.";
    expect(
      assertNoHiddenDraftLeak(
        "The secret answer key sentence about shuttle",
        hidden,
        "I started with the coach.",
      ).ok,
    ).toBe(false);
    expect(
      assertNoHiddenDraftLeak("I started with the coach.", hidden, "I started with the coach.", "CANARYTOKEN").ok,
    ).toBe(true);
    expect(assertNoHiddenDraftLeak("see CANARYTOKEN here", hidden, "coach", "CANARYTOKEN")).toMatchObject({
      rule: "canary",
    });
    const read = shapeReadback({
      ideas: [
        { id: "a", text: "first idea", sectionKey: "intro" },
        { id: "b", text: "second idea", sectionKey: "body" },
      ],
      signals: [
        { ideaId: "b", sectionKey: "intro", confidence: 0.8 },
        { ideaId: "a", sectionKey: "body", confidence: 0.4 },
      ],
    });
    expect(read.flags.length).toBeLessThanOrEqual(2);
    expect(read.flags.every((flag) => flag.confidence >= 0.7)).toBe(true);
  });
});
