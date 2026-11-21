import { describe, expect, it } from "vitest";
import { buildFramework, promoteIdea } from "@/lib/drafting/framework";
import {
  buildLedger,
  ledgerItemsAreVerbatim,
  type LedgerInput,
} from "@/lib/drafting/ledger";
import { assertWriteInOrder, jumpTargetAllowed, type OrderParagraph } from "@/lib/drafting/order";

const input: LedgerInput = {
  paperId: "paper-1",
  promptType: "lesson",
  storyAngle: "a coach who listened first",
  thesis: "Listening is the part of leadership I want to show",
  lessonConcept: "servant leadership",
  assignmentText: "Explain servant leadership with examples.",
  sections: [
    {
      key: "body",
      title: "Body",
      kind: "body",
      mode: "lesson",
      ideas: ["He listened before he decided"],
      chosenLead: "a coach",
      claim: "Listening comes before the decision",
    },
  ],
};

describe("locked ledger and framework", () => {
  it("keeps only verbatim student text and opens the intro first", () => {
    const ledger = buildLedger(input);
    expect(ledger.sections[0]?.items.every((item) => item.origin === "student" || item.origin === "source")).toBe(
      true,
    );
    expect(ledgerItemsAreVerbatim(ledger, JSON.stringify(input).toLowerCase() + input.storyAngle)).toBe(true);
    const plan = buildFramework(ledger, { counterRequired: false });
    expect(plan.map((row) => row.kind)).toEqual(["intro", "body", "conclusion"]);
    expect(plan[0]?.key).toBe("intro");
    expect(buildFramework(ledger, { counterRequired: true }).some((row) => row.kind === "counter")).toBe(true);
  });

  it("caps promoted paragraphs at 3", () => {
    const ledger = buildLedger(input);
    let plan = buildFramework(ledger);
    const first = promoteIdea(plan, "body", "a second point");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    plan = first.paragraphs;
    plan = (promoteIdea(plan, "body", "a third point") as { paragraphs: typeof plan }).paragraphs;
    expect(promoteIdea(plan, "body", "a fourth point").ok).toBe(false);
  });

  it("rejects a write to a later section on the server rule", () => {
    const rows: OrderParagraph[] = [
      { key: "intro", sectionKey: "intro", status: "open" },
      { key: "body", sectionKey: "body", status: "locked" },
      { key: "conclusion", sectionKey: "conclusion", status: "locked" },
    ];
    expect(assertWriteInOrder(rows, "body").ok).toBe(false);
    rows[0]!.status = "saved";
    expect(assertWriteInOrder(rows, "body").ok).toBe(true);
    expect(jumpTargetAllowed(rows, "conclusion", "body")).toBe(false);
    expect(jumpTargetAllowed([{ ...rows[0]!, status: "saved" }, rows[1]!, rows[2]!], "intro", "body")).toBe(true);
  });
});
