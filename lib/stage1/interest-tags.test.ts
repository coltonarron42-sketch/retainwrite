import { describe, expect, it } from "vitest";
import {
  containsSensitiveContent,
  extractInterestTags,
} from "@/lib/stage1/interest-tags";

describe("interest tags", () => {
  it("extracts volunteered topical tags", () => {
    const tags = extractInterestTags([
      "I love skateboarding and local music scenes.",
      "I'm into podcasts about small business.",
    ]);
    expect(tags.some((t) => t.includes("skateboarding") || t.includes("podcast"))).toBe(
      true,
    );
  });

  it("does not promote sensitive content to standing tags", () => {
    expect(containsSensitiveContent("I am Christian and Democrat")).toBe(true);
    const tags = extractInterestTags([
      "My Christian faith and Democrat politics shape me",
      "I love hiking",
    ]);
    expect(tags.every((t) => !t.includes("christian") && !t.includes("democrat"))).toBe(
      true,
    );
  });
});
