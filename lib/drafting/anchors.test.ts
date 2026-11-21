import { describe, expect, it } from "vitest";
import { draftingAnchors } from "@/lib/drafting/anchors";

describe("drafting anchors", () => {
  it("uses the intro note and the story answer, not the topic or the Stage 2 header", () => {
    const anchors = draftingAnchors({
      introNote: "I want to look at sleep, not claim social media causes all depression.",
      storyAnswer: "I scroll TikTok when I cannot sleep.",
    });
    expect(anchors.mainPoint).toMatch(/sleep/);
    expect(anchors.mainPoint).not.toBe("how social media affects teen mental health");
    expect(anchors.story).toMatch(/TikTok/);
    expect(anchors.story).not.toMatch(/assigned concept/);
    expect(
      draftingAnchors({ introNote: "", storyAnswer: "" }),
    ).toEqual({ mainPoint: "", story: "" });
  });
});
