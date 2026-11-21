import { describe, expect, it } from "vitest";
import { canStartAssignmentParse } from "@/lib/assignment/can-start-parse";

describe("canStartAssignmentParse", () => {
  it("allows photos-only with rights (no paste)", () => {
    expect(
      canStartAssignmentParse({
        fileCount: 3,
        pasteText: "",
        linkCount: 0,
        rightsOk: true,
      }),
    ).toBe(true);
  });

  it("blocks when there is nothing to read", () => {
    expect(
      canStartAssignmentParse({
        fileCount: 0,
        pasteText: "",
        linkCount: 0,
        rightsOk: true,
      }),
    ).toBe(false);
  });

  it("blocks without rights confirmation", () => {
    expect(
      canStartAssignmentParse({
        fileCount: 2,
        pasteText: "",
        linkCount: 0,
        rightsOk: false,
      }),
    ).toBe(false);
  });
});
