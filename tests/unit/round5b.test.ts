/** QA 2:12 PM (PR #70 round 5b): rapid send, story-pick 400, Past chat, gate copy. Code-level only. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keepSubstance, namedPerson } from "@/lib/stage1/north-turns";
import { storyAngleText, storyWho, reflectStory } from "@/lib/stage1/story-reflect";
import { northstarChecklist } from "@/lib/stage1/intake-resume";
import { screenLines } from "@/lib/chat/turn-recorder";
import { readyVoiceLine } from "@/lib/stage1/voice";
import { wordCount } from "@/lib/utils";

const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
const recorder = readFileSync("lib/chat/turn-recorder.ts", "utf8");
const exact = JSON.parse(readFileSync("tests/fixtures/colton-t204u-exact.json", "utf8")) as { story: string };

describe("MUST-FIX 1: 'My high school soccer coach, Mr. Alvarez' then 'ok'", () => {
  it("the trailing 'ok' never turns the answer into a non-answer", () => {
    expect(keepSubstance(["My high school soccer coach, Mr. Alvarez", "ok"])).toBe("My high school soccer coach, Mr. Alvarez");
    expect(keepSubstance(["hmm", "My boss Dana"])).toBe("My boss Dana");
    expect(keepSubstance(["wait", "one sec"])).toBe("wait\none sec");
    expect(keepSubstance(["ok"])).toBe("ok");
    expect(keepSubstance(["yes", "but interview me first"])).toBe("yes\nbut interview me first");
  });
  it("a title and surname is a named leader", () => {
    expect(storyWho("My high school soccer coach, Mr. Alvarez")).toEqual({ who: "Mr. Alvarez", named: true });
    expect(storyWho("Coach Taylor from my club")).toEqual({ who: "Coach Taylor", named: true });
    expect(storyWho("Mrs. Patel, my 8th grade teacher")?.who).toBe("Mrs. Patel");
    expect(storyWho("my high school soccer coach")).toEqual({ who: "your coach", named: false });
    expect(reflectStory("My high school soccer coach, Mr. Alvarez", { tentative: true })?.who ?? "Mr. Alvarez").toBe("Mr. Alvarez");
    // Unchanged: Mandy and Walton.
    expect(storyWho(exact.story)?.who).toBe("Mandy");
    expect(namedPerson("Servant fits because Walton visited stores")).toBe("Walton");
  });
  it("the composer sends the substance, keeps each message its own bubble, and the no-leaders path starts on the named person", () => {
    expect(intake).toContain("const merged = keepSubstance(partsOf(joined));");
    expect(intake).toContain("saidParts.current.set(coalesce.current.text, parts)");
    expect(intake).toContain("{saidBubbles(a.said)}");
    expect(intake).toContain("{saidBubbles(pendingSaid)}");
    expect(intake).toContain('slot: "leader", named: who });');
    expect(intake).toContain("works great. Let's dig in, one quick question at a time.");
    expect(intake).toMatch(/const said0Named = \(t: string\) => Boolean\(storyWho\(t\)\?\.named/);
  });
  it("style chips hide under the boss/coach/teacher ask", () => {
    expect(intake).toContain('aria-label="Options" hidden={Boolean(noLeaderAsked.current[q.id])}');
  });
});

describe("MUST-FIX 2: story-pick never 400s on a long story", () => {
  it("Colton's 742-character story goes as at most 500 characters of his own sentences, 15+ words", () => {
    expect(exact.story.length).toBeGreaterThan(500);
    const a = storyAngleText(exact.story);
    expect(a.length).toBeLessThanOrEqual(500);
    expect(wordCount(a)).toBeGreaterThanOrEqual(15);
    expect(exact.story.replace(/\s+/g, " ")).toContain(a.replace(/…$/, ""));
  });
  it("short stories go whole; one long sentence is cut on a word", () => {
    expect(storyAngleText("a b c")).toBe("a b c");
    const long = Array.from({ length: 200 }, () => "word").join(" ");
    const a = storyAngleText(long);
    expect(a.length).toBeLessThanOrEqual(500);
    expect(a.endsWith("word…")).toBe(true);
  });
  it("the client posts the clipped angle, only when it clears the 15-word gate", () => {
    expect(intake).toContain("const angle = storyAngleText(story);");
    expect(intake).toContain("if (wordCount(angle) >= 15) void fetch(`/api/papers/${paperId}/intake/story-pick`");
    expect(intake).not.toContain("JSON.stringify({ text: story, source: \"student\" })");
  });
});

describe("Past chat", () => {
  const el = (n: number) => ({ id: n }) as unknown as Element;
  it("a short line ('ok', 'No rush.') off screen isn't 'covered' by a longer bubble that contains it", () => {
    const a = el(1), b = el(2), c = el(3);
    const recs = [
      { who: "pau" as const, text: "Who's a boss, coach or teacher you've had?", el: a, at: 0, born: 0 },
      { who: "you" as const, text: "ok", el: null, at: 1, born: 1, gone: 2 },
      { who: "pau" as const, text: "No rush. Think of anyone who ran a team. Who comes to mind first? Looks ok?", el: b, at: 2, born: 2 },
      { who: "you" as const, text: "hmm", el: c, at: 3, born: 3 },
    ];
    const onScreen = [
      { el: a, who: "pau" as const, text: recs[0]!.text },
      { el: b, who: "pau" as const, text: recs[2]!.text },
      { el: c, who: "you" as const, text: "hmm" },
    ];
    expect(screenLines(recs as never, onScreen).map((l) => l.text)).toEqual([recs[0]!.text, "ok", recs[2]!.text, "hmm"]);
  });
  it("a spark offer drawn outside a bubble is still a Pau line", () => {
    expect(recorder).toContain('querySelectorAll("[data-chat-line], [data-chat-part]")');
  });
});

describe("minor copy", () => {
  it("the gate says the story counts as the early take on the story path", () => {
    const base = { confirmed: true, catchUpDone: true, decided: true, stanceOk: true };
    expect(northstarChecklist({ ...base, earlyFromStory: true }).at(-1)?.label).toBe("Early take: your story counts as your early take");
    expect(northstarChecklist(base).at(-1)?.label).toBe("Early take: a few sentences in your own words");
  });
  it("first person: I've got enough of your voice", () => {
    expect(readyVoiceLine(400)).toBe("I've got enough of your voice to coach you.");
  });
});
