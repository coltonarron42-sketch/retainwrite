import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetSpeech, beginSpeakScope, noteInteraction, takeNew, textMark } from "@/lib/voice/speech";
import { parseWelcomeState, welcomeBackLine, WELCOME_BACK_GAP_MS, WELCOME_BACK_LINES } from "@/lib/coach/welcome-back";
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
  it("none for a new conversation; one for history; none on rapid reloads", () => {
    expect(welcomeBackLine({ hasHistory: false, last: null, now: 10000 })).toBeNull();
    const first = welcomeBackLine({ hasHistory: true, last: null, now: 10000 })!;
    expect(WELCOME_BACK_LINES).toContain(first.line);
    expect(welcomeBackLine({ hasHistory: true, last: first.next, now: 10001 })).toBeNull();
    expect(welcomeBackLine({ hasHistory: true, last: first.next, now: 10000 + WELCOME_BACK_GAP_MS - 1 })).toBeNull();
    const second = welcomeBackLine({ hasHistory: true, last: first.next, now: 10000 + WELCOME_BACK_GAP_MS })!;
    expect(second.line).not.toBe(first.line);
  });
  it("bad storage doesn't duplicate or crash the welcome", () => {
    expect(parseWelcomeState("broken")).toBeNull();
    expect(parseWelcomeState('{"at":123,"n":2}')).toEqual({ at: 123, n: 2 });
    expect(parseWelcomeState('{"at":"x"}')).toBeNull();
  });
});

describe("citation comfort question names the style", () => {
  it.each(["MLA 9", "APA 7", "Chicago", "ASA"])('%s is said by name', (style) => {
    const q = citationComfortQuestion(style === "ASA" ? { citationStyle: { value: "other" }, citationStyleOther: "ASA" } : { citationStyle: { value: style } });
    expect(q).toContain(`${style} citations`);
    expect(q).not.toMatch(/other citations/);
  });
});
