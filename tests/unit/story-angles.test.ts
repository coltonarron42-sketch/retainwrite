import { describe, expect, it } from "vitest";
import {
  assertStoryAngleQuestion,
  buildStoryAngleFallback,
  cleanInterestPhrase,
} from "@/lib/stage1/story-angles";

describe("story angles", () => {
  it("builds 3–4 question angles ending in ?", () => {
    const angles = buildStoryAngleFallback({
      topic: "margin for owners",
      studentPhrases: ["raised prices at the shop last spring"],
    });
    expect(angles.length).toBeGreaterThanOrEqual(3);
    expect(angles.length).toBeLessThanOrEqual(4);
    for (const a of angles) {
      expect(assertStoryAngleQuestion(a.question)).toBe(true);
    }
  });

  it("does not glue a filler interest onto the topic", () => {
    expect(cleanInterestPhrase("idk music")).toBe("music");
    const angles = buildStoryAngleFallback({
      topic: "Social media and teen mental health",
      studentPhrases: ["idk music"],
    });
    const personal = angles.find((angle) => angle.id === "change");
    expect(personal?.question).toMatch(/you mentioned music/i);
    expect(personal?.question).not.toMatch(/idk/i);
    expect(personal?.question).not.toMatch(/Social media and teen mental health/);
    const mentions = angles.filter((angle) =>
      angle.question.includes("Social media and teen mental health"),
    );
    expect(mentions).toHaveLength(1);
  });

  it("does not cut a phrase mid-word or keep a junk topic", () => {
    const phrase = cleanInterestPhrase(
      "I watch a few YouTube videos about homework every single night after practice",
    );
    expect(phrase?.endsWith("You")).toBe(false);
    expect(phrase?.includes("…")).toBe(false);
    const angles = buildStoryAngleFallback({
      topic: "paper??",
      studentPhrases: [],
    });
    expect(angles.find((angle) => angle.id === "disagree")?.question).not.toMatch(/paper\?\?/);
    expect(angles.find((angle) => angle.id === "disagree")?.question).toMatch(/this assignment/);
  });

  it("ends a story card on a clause and drops paper??", () => {
    const phrase = cleanInterestPhrase(
      "…scroll TikTok with my friends after class when I cannot sleep",
    );
    expect(phrase).not.toMatch(/…/);
    expect(phrase).not.toMatch(/\bwith$/i);
    expect(phrase).toMatch(/TikTok/);
    const angles = buildStoryAngleFallback({
      topic: "paper??",
      studentPhrases: ["…scroll TikTok with my friends after class"],
    });
    const blob = JSON.stringify(angles);
    expect(blob).not.toMatch(/paper\?\?/);
    expect(blob).not.toMatch(/TikTok with\./);
  });
});

