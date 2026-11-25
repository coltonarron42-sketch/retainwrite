import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { __resetSpeech, armSpeech, beginSpeakScope, currentTurn, noteInteraction, speechArmed, takeNew, textMark } from "@/lib/voice/speech";
import { welcomeBackLine, WELCOME_BACK_LINES } from "@/lib/coach/welcome-back";
import { setLocalUser } from "@/lib/local/user-scope";
import { citationComfortQuestion } from "@/lib/stage1/comfort";

const data = new Map<string, string>();
const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) };

beforeEach(() => { data.clear(); __resetSpeech(); setLocalUser("alice"); });
afterEach(() => { vi.unstubAllGlobals(); setLocalUser(null); __resetSpeech(); });

describe("3:46 PM: restored turns are never replayed", () => {
  it("persists the per-paper seen marker under the signed-in user, including turns rendered with voice off", () => {
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
    noteInteraction(); // the student acted on this visit
    const a = { key: "a", text: "A line already rendered." };
    const b = { key: "b", text: "Her new line." };
    expect(takeNew("paper1", [a])).toEqual([]);
    expect(takeNew("paper1", [a, b])).toEqual([b]);
    expect(data.has("rw:u:alice:heard:paper1")).toBe(true);
    // Reload: empty JS memory; history can arrive in pieces under NEW keys.
    __resetSpeech(); noteInteraction();
    expect(takeNew("paper1", [{ ...a, key: "restore-a" }])).toEqual([]);
    expect(takeNew("paper1", [{ ...a, key: "restore-a" }, { ...b, key: "restore-b" }])).toEqual([]);
    // Stages 2-3 obey the same rule, with a shared per-paper marker.
    expect(takeNew("paper1:stage2", [])).toEqual([]);
    expect(takeNew("paper1:stage2", [{ ...b, key: "s2-a" }])).toEqual([]);
    expect(takeNew("paper1:stage3", [])).toEqual([]);
    expect(takeNew("paper1:stage3", [{ ...b, key: "s3-a" }])).toEqual([]);
    const c = { key: "new", text: "Only this is new." };
    expect(takeNew("paper1:stage3", [c])).toEqual([c]);
  });
  it("an in-app return starts silently even when the page has already had a tap", () => {
    noteInteraction();
    takeNew("p1", [{ key: "a", text: "First." }]);
    takeNew("p1", [{ key: "b", text: "Second." }]);
    beginSpeakScope("p1");
    expect(takeNew("p1", [{ key: "new-key", text: "Second." }])).toEqual([]);
    expect(takeNew("p1", [{ key: "late", text: "First." }])).toEqual([]);
  });
  it("the marker normalizes whitespace", () => {
    expect(textMark(" One   line. \n")).toBe(textMark("One line."));
  });
});

describe("3:46 PM: exactly one welcome-back on a return", () => {
  // PC-28: the line is picked once per return (claimReturn guards reloads); it names what's done and what's next.
  it("one line per pick, from the list, naming done and next", () => {
    const first = welcomeBackLine({ done: "idea 2", next: "idea 3" });
    expect(WELCOME_BACK_LINES).toContain(first.line);
    expect(welcomeBackLine({ done: "idea 2", next: "idea 3" }, first.index).line).toBe(first.line);
  });
  it("no done yet still reads fine", () => {
    const { line } = welcomeBackLine({ done: null, next: "the body" }, 0);
    expect(line).toMatch(/the body/);
    expect(line).not.toMatch(/\{|null|undefined/);
  });
});

describe("citation comfort question names the style", () => {
  it.each(["MLA 9", "APA 7", "Chicago", "ASA"])('%s is said by name', (style) => {
    const q = citationComfortQuestion(style === "ASA" ? { citationStyle: { value: "other" }, citationStyleOther: "ASA" } : { citationStyle: { value: style } });
    expect(q).toContain(`${style} citations`);
    expect(q).not.toMatch(/other citations/);
  });
});

describe("5:03 PM: the queue only ever holds turns from after the restore", () => {
  const g = globalThis as Record<string, unknown>;
  afterEach(() => {
    delete g.window;
    vi.unstubAllGlobals();
    __resetSpeech();
  });
  const restored = [
    { key: "r0", text: "Hi, I'm Pau Pau. What's the assignment?", turn: true },
    { key: "r1", text: "Okay, I've read it through.", turn: true },
  ];
  it("sticky activation, late restores and a second chat on the same paper stay silent (no heard marks: another device)", () => {
    __resetSpeech();
    g.window = { location: { pathname: "/app/papers/p/stage/1" } };
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
    expect(takeNew("p", [])).toEqual([]);
    expect(takeNew("p", restored)).toEqual([]);
    expect(takeNew("p", [...restored, { key: "confirm:0", text: "This is for ENG 101." }])).toEqual([]);
    expect(currentTurn()).toEqual([]);
  });
  it("after a real reply only the new turn is read; the Voice switch never re-reads history", () => {
    __resetSpeech();
    g.window = { location: { pathname: "/app/papers/p/stage/2" } };
    expect(takeNew("p:stage2", restored)).toEqual([]);
    expect(currentTurn()).toEqual([]);
    armSpeech();
    const reply = { key: "n0", text: "On to your body.", turn: true };
    expect(takeNew("p:stage2", [...restored, reply])).toEqual([reply]);
    expect(currentTurn()).toEqual(["On to your body."]);
  });
  it("a new route disarms (an in-app return), unless the student's action led there a moment ago", () => {
    __resetSpeech();
    const w = { location: { pathname: "/app/papers/p/stage/1" } };
    g.window = w;
    armSpeech();
    w.location.pathname = "/app/papers/p/stage/2";
    expect(speechArmed()).toBe(true); // moved on by the student's tap
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);
    w.location.pathname = "/app";
    expect(speechArmed()).toBe(false);
    w.location.pathname = "/app/papers/p/stage/3";
    expect(takeNew("p:stage3", restored)).toEqual([]);
    vi.useRealTimers();
  });
  it("taps on the voice controls never arm her; Send and choice buttons do", () => {
    const src = readFileSync("lib/voice/speech.ts", "utf8");
    expect(src).toMatch(/\[data-voice-toggle\],\[data-replay\],\[data-tap-to-hear\],\[data-mic-mute\],\[data-barge-in\]/);
    expect(src).not.toMatch(/function interactedThisLoad/);
    expect(readFileSync("components/stages/stage1/chat-composer.tsx", "utf8")).toMatch(/armSpeech\(\);\n\s*onSend\(\);/);
  });
});
