import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LogicCheckpoint } from "@/components/coaching/logic-checkpoint";
import { LOGIC_CONTINUE, LOGIC_PASS } from "@/lib/coaching/logicCheck";
import { initialStageProgress } from "@/lib/stages/assert";
import {
  advanceFromStage2ThroughEnd,
  advanceProductStage,
  healStuckOutlineSession,
  productStageBounce,
  progressAfterLogicContinue,
  sectionContinueTarget,
} from "@/lib/stages/advance";

function startAtStance() {
  return initialStageProgress().map((row) => {
    if (row.stage === 1) return { ...row, status: "complete" as const };
    if (row.stage === 2) return { ...row, status: "in_progress" as const };
    return row;
  });
}

describe("logic-check continue from stage 2", () => {
  it("shows Continue after Looks solid and still offers Continue anyway on a strong flag", () => {
    const pass = renderToStaticMarkup(
      createElement(LogicCheckpoint, {
        phase: "pass",
        onContinue: () => undefined,
        onChoice: () => undefined,
      }),
    );
    expect(pass).toContain(LOGIC_PASS);
    expect(pass).toContain("Looks solid");
    expect(pass).toContain("Continue");
    expect(pass).not.toContain(LOGIC_CONTINUE);

    const strong = renderToStaticMarkup(
      createElement(LogicCheckpoint, {
        phase: "strong",
        reason: "The claim conflicts with the assignment.",
        onContinue: () => undefined,
        onChoice: () => undefined,
      }),
    );
    expect(strong).toContain(LOGIC_CONTINUE);
    expect(strong).toContain("Continue anyway");
  });

  it("moves to the next section on a pass, then through every later stage", () => {
    const sections = [
      { status: "confirmed" },
      { status: "open" },
      { status: "open" },
    ];
    expect(sectionContinueTarget(sections, 0)).toEqual({ kind: "section", index: 1 });

    const stay = progressAfterLogicContinue(startAtStance(), "section");
    expect(stay.blocked).toBe(false);
    expect(stay.nextStage).toBe(2);
    expect(stay.progress.find((row) => row.stage === 3)?.status).toBe("locked");

    const done = sectionContinueTarget(
      [{ status: "confirmed" }, { status: "confirmed" }, { status: "confirmed" }],
      2,
    );
    expect(done).toEqual({ kind: "outline" });

    const walked = advanceFromStage2ThroughEnd(startAtStance());
    expect(walked.blocked).toBe(false);
    expect(walked.stages).toEqual([2, 3, 4, 5, 6]);
    expect(walked.progress.map((row) => row.status)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
      "in_progress",
    ]);
    expect(advanceProductStage(walked.progress, 6).nextStage).toBe(6);
  });

  it("lets Continue anyway advance and never blocks", () => {
    const strong = progressAfterLogicContinue(startAtStance(), "outline");
    expect(strong.blocked).toBe(false);
    expect(strong.nextStage).toBe(3);
    expect(strong.progress.find((row) => row.stage === 2)?.status).toBe("complete");
    expect(strong.progress.find((row) => row.stage === 3)?.status).toBe("in_progress");
  });

  it("keeps Outline open when Stance progress is complete even if Body is still open in the saved session", () => {
    const progress = progressAfterLogicContinue(startAtStance(), "outline").progress;
    expect(
      productStageBounce({
        stage: 3,
        progress,
        sections: [
          { status: "confirmed" },
          { status: "open" },
          { status: "confirmed" },
        ],
      }),
    ).toBe("stay");
    expect(
      productStageBounce({
        stage: 3,
        progress: startAtStance(),
        sections: [{ status: "open" }, { status: "open" }, { status: "confirmed" }],
      }),
    ).toBe("stance");
  });

  it("repairs a paper stuck on the Conclusion save after Outline unlocked", () => {
    const healed = healStuckOutlineSession({
      currentStage: 3,
      progress: [
        { stage: 2, status: "complete" },
        { stage: 3, status: "in_progress" },
      ],
      sections: [
        { status: "confirmed", loopStep: "confirmed" },
        { status: "open", loopStep: "search" },
        { status: "open", loopStep: "search" },
      ],
      resume: { stage: 2, screen: "stance" },
    });
    expect(healed.healed).toBe(true);
    expect(healed.sections.every((section) => section.status === "confirmed")).toBe(true);
    expect(healed.sections[2]?.loopStep).toBe("confirmed");
    expect(healed.resume).toEqual({ stage: 3, screen: "outline" });
    expect(healed.resume && healed.resume.stage >= 3).toBe(true);
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    const confirm = loop.slice(loop.indexOf("async function continueAfterLogic"), loop.indexOf("function continueProductStage"));
    expect(confirm.indexOf("await persistField")).toBeGreaterThan(-1);
    expect(confirm.indexOf("await persistField")).toBeLessThan(confirm.indexOf("persistAndGo"));
    expect(confirm).toContain('screen: "outline"');
    expect(loop).toContain("healStuckOutlineSession");
  });
});
