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

  it("drops when/where tails so a tag never ends on a preposition", () => {
    const tags = extractInterestTags(["I love baking sourdough on weekends, hanging out with friends, and playing soccer with my club team."]);
    expect(tags).toEqual(["baking sourdough", "soccer"]);
    expect(extractInterestTags(["watching basketball every night and the history of jazz"])).toEqual(["basketball", "history of jazz"]);
    for (const tag of tags) expect(tag).not.toMatch(/\b(on|in|at|for|with|to)$/);
  });
});
