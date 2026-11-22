import { describe, expect, it } from "vitest";
import { mergeTileTexts } from "@/lib/assignment/tile-merge";

describe("tile merge", () => {
  it("drops the overlap read by both halves, including a cut-off line", () => {
    const top = "ENG 101\nInstructor: Prof. Dana Ruiz\nWrite an argumentative essay that takes a clear position.\nUse at least three scholarly sources. One of th";
    const bottom = "position.\nUse at least three scholarly sources. One of them must be the AAP 2014 statement.\nRubric (100 points)";
    expect(mergeTileTexts(top, bottom)).toBe(
      "ENG 101\nInstructor: Prof. Dana Ruiz\nWrite an argumentative essay that takes a clear position.\nUse at least three scholarly sources. One of them must be the AAP 2014 statement.\nRubric (100 points)",
    );
  });
  it("keeps both when nothing overlaps", () => {
    expect(mergeTileTexts("Top line here is long", "Bottom line is different")).toBe("Top line here is long\nBottom line is different");
  });
});
