import { describe, expect, it } from "vitest";
import { assertCoachingOnly } from "@/lib/ai/guard";

describe("coaching guard", () => {
  it("allows questions", () => {
    expect(assertCoachingOnly("What is your early take on this topic?").ok).toBe(
      true,
    );
  });

  it("rejects rewrite offers", () => {
    expect(
      assertCoachingOnly("Here's a rewritten paragraph you can use instead.").ok,
    ).toBe(false);
  });
});
