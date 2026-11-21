import { describe, expect, it } from "vitest";
import { applyOutlineDrafts } from "@/lib/papers/outline";

describe("outline drafts", () => {
  it("keeps an Intro and Body edit after reload instead of the old stance note", () => {
    const sections = applyOutlineDrafts(
      [
        { key: "intro", ideas: ["idk what I want to say yet"] },
        { key: "body", ideas: ["Social media causes all teen depression"] },
        { key: "conclusion", ideas: ["Close it"] },
      ],
      [
        { fieldKey: "outline:intro", text: "Schools should look at sleep, not blame every teen." },
        { fieldKey: "outline:body", text: "One study of late-night scrolling is the example I want." },
      ],
    );
    expect(sections.find((section) => section.key === "intro")?.ideas).toEqual([
      "Schools should look at sleep, not blame every teen.",
    ]);
    expect(sections.find((section) => section.key === "body")?.ideas[0]).toMatch(/late-night scrolling/);
    expect(sections.find((section) => section.key === "conclusion")?.ideas).toEqual(["Close it"]);
  });

  it("does not wipe Stance notes when a saved outline draft is blank", () => {
    const sections = applyOutlineDrafts(
      [
        { key: "intro", ideas: ["Schools should rethink phone rules at night."] },
        { key: "body", ideas: ["Late-night scrolling cuts sleep."] },
      ],
      [
        { fieldKey: "outline:intro", text: "" },
        { fieldKey: "outline:body", text: "   " },
      ],
    );
    expect(sections[0].ideas).toEqual(["Schools should rethink phone rules at night."]);
    expect(sections[1].ideas).toEqual(["Late-night scrolling cuts sleep."]);
  });
});
