import { describe, expect, it } from "vitest";
import { foldLines, screenLines } from "@/lib/chat/turn-recorder";

type R = Parameters<typeof foldLines>[0][number];
const el = () => ({}) as Element;

describe("Colton 12:11 (e): Past chat is the screen", () => {
  it("drops a re-shaped ask the screen no longer shows, and a lead-in redraw duplicate (QA r10 c-solid)", () => {
    const a = el(), b = el(), c = el(), d = el();
    const ask = "Last one before the stance interview. Now your case: how did it show up, and why does it work best? A few sentences is your early take, rough is fine.";
    const recs: R[] = [
      { who: "pau", text: "Awesome, sounds like you have a good idea of what this paper needs. Here is the checklist: a real leader, your style, your case.\nNext up is your example. When did Satya Nadella lead a change?", el: null, born: 1, gone: 5 },
      { who: "pau", text: ask + " A few sentences is perfect.", el: null, born: 6, gone: 9 },
      { who: "you", text: "Transformational works best for change since Nadella gave people a reason to want it.", el: c, born: 8 },
      { who: "pau", text: ask, el: null, born: 9, gone: 10 },
      { who: "pau", text: "That's everything for Stage 1.", el: d, born: 11 },
    ];
    const screen = [
      { el: b, who: "pau" as const, text: "Awesome, sounds like you have a good idea of what this paper needs. Here is the checklist: a real leader, your style, your case.\n" + ask },
      { el: c, who: "you" as const, text: recs[2].text },
      { el: d, who: "pau" as const, text: "That's everything for Stage 1." },
    ];
    void a;
    expect(screenLines(recs, screen).map((l) => l.text)).toEqual(screen.map((s) => s.text));
  });

  it("keeps an answered turn a screen hides for a moment, in its place", () => {
    const b = el(), c = el();
    const recs: R[] = [
      { who: "pau", text: "Where are you with it?", el: null, born: 1, gone: 9 },
      { who: "you", text: "I read both chapters.", el: null, born: 2, gone: 9 },
      { who: "pau", text: "Nice. Which style?", el: b, born: 3 },
      { who: "you", text: "Servant.", el: c, born: 4 },
    ];
    const screen = [
      { el: b, who: "pau" as const, text: "Nice. Which style?" },
      { el: c, who: "you" as const, text: "Servant." },
    ];
    expect(screenLines(recs, screen).map((l) => l.text)).toEqual(["Where are you with it?", "I read both chapters.", "Nice. Which style?", "Servant."]);
  });

  it("saved lines from an earlier visit come first; redrawn history (quiet) isn't doubled", () => {
    const q = el(), n = el();
    const recs: R[] = [
      { who: "pau", text: "Hi, I'm Pau.", el: null },
      { who: "you", text: "BUS 210 essay", el: q },
      { who: "pau", text: "Hi, I'm Pau.", el: el(), quiet: true },
      { who: "pau", text: "Welcome back.", el: n, born: 5 },
    ];
    const screen = [
      { el: q, who: "you" as const, text: "BUS 210 essay" },
      { el: n, who: "pau" as const, text: "Welcome back." },
    ];
    expect(screenLines(recs, screen).map((l) => l.text)).toEqual(["Hi, I'm Pau.", "BUS 210 essay", "Welcome back."]);
  });
});
