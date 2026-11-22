import { describe, expect, it } from "vitest";
import { extractInterestTags } from "@/lib/stage1/interest-tags";

describe("interest tags", () => {
  it("prefers specific interests over generic phrases", () => {
    expect(extractInterestTags(["hanging out with my cousin Mia and baking sourdough, plus watching soccer"])[0]).toBe("baking sourdough");
    expect(extractInterestTags(["hanging out with my cousin Mia and baking sourdough, plus watching soccer"])).toContain("soccer");
    expect(extractInterestTags(["I follow soccer and I bake sourdough with my cousin Mia."])[0]).toBe("soccer");
    expect(extractInterestTags(["zebra-draft I like soccer and baking sourdough with my cousin Mia"])[0]).toBe("soccer");
    expect(extractInterestTags(["the show Bluey and my grandpa fishing trips"])).not.toContain("my grandpa fishing trips");
  });
});
