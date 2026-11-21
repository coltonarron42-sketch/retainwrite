import { describe, expect, it } from "vitest";
import { assignmentAlertQuote, finalizeLogicCheck, logicCheckFromNotes } from "@/lib/coaching/logicCheck";
import {
  quoteOnWordBoundary,
  refreshStoredLogic,
  replaceClaim,
  revisionPrefill,
} from "@/lib/coaching/logicRevision";

const ASSIGNMENT = "Explain how social media affects teen mental health. Use evidence you can check.";

const OLD_CLAIM =
  "Social media causes all teen depression because my friend was sad after Instagram";

const REVISED =
  "Some teens lose sleep after late-night social media use, and one classmate's experience is not enough to explain teen mental health.";

function claimCutMidWord(): string {
  const tail = "mental health every single night after practice.";
  let prefix =
    "Social media causes all teen depression because my friend was sad after Instagram. ";
  while (!(prefix + tail).slice(0, 160).endsWith("healt")) prefix += "Also ";
  return prefix + tail;
}

describe("logic revision from the QA claim", () => {
  it("quotes the pasted claim on a word boundary instead of cutting at mental healt", () => {
    const notes = claimCutMidWord();
    expect(notes.slice(0, 160)).toMatch(/mental healt$/);
    const quoted = quoteOnWordBoundary(notes, 160);
    expect(quoted.endsWith("healt")).toBe(false);
    expect(quoted.endsWith("mental") || quoted.includes("mental health")).toBe(true);
    const check = logicCheckFromNotes({
      notes,
      assignmentText: ASSIGNMENT,
      rubricRef: "prompt",
      mode: "lesson",
    });
    expect(check.studentClaimRef?.quote.endsWith("healt")).toBe(false);
    const raw = claimCutMidWord();
    expect(raw.slice(0, 80).endsWith("healt") || raw.slice(0, 160).endsWith("healt")).toBe(true);
    expect(
      assignmentAlertQuote({
        confirmedPrompt: "How does social media affect teen mental health?",
        raw,
      }),
    ).toBe("How does social media affect teen mental health?");
    const flagged = logicCheckFromNotes({
      notes: OLD_CLAIM,
      assignmentText: raw,
      confirmedPrompt: "How does social media affect teen mental health?",
      rubricRef: "prompt",
      mode: "lesson",
    });
    expect(flagged.citedTerm?.quote).toBe("How does social media affect teen mental health?");
    expect(flagged.citedTerm?.quote.endsWith("healt")).toBe(false);
  });

  it("prefills revise, reframe, and a new angle with the current claim", () => {
    expect(revisionPrefill([OLD_CLAIM])).toBe(OLD_CLAIM);
    expect(revisionPrefill([OLD_CLAIM])).not.toBe("");
  });

  it("replaces the stored claim instead of appending the revision", () => {
    const stored = replaceClaim([OLD_CLAIM], REVISED);
    expect(stored).toEqual([REVISED]);
    expect(stored.join("\n")).not.toContain("causes all teen depression");
  });

  it("re-runs the check on the new text only, so a reasonable revision is not stuck flagged", () => {
    const stuck = finalizeLogicCheck(
      logicCheckFromNotes({
        notes: OLD_CLAIM,
        assignmentText: ASSIGNMENT,
        rubricRef: "prompt",
        mode: "lesson",
      }),
      {
        assignmentText: ASSIGNMENT,
        studentNotes: OLD_CLAIM,
        mode: "lesson",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["prompt"],
      },
    );
    expect(stuck.result.tier).toBe("strong");
    const refreshed = refreshStoredLogic(
      {
        ideas: [REVISED],
        logic: stuck,
        loopStep: "logic_check",
      },
      { assignmentText: ASSIGNMENT, rubricRef: "prompt", mode: "lesson" },
    );
    expect(refreshed.logic?.result.tier).not.toBe("strong");
    expect(refreshed.logic?.result.reason ?? "").not.toMatch(/everyone/);
    expect(refreshed.ideas).toEqual([REVISED]);
  });
});
