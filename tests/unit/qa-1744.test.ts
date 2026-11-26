// @vitest-environment jsdom
// QA 5:44 PM race: reopen, then Voice off/on, Mute/Unmute, a blank click and a
// remount while the chat hydrates. No duplicate intro, only the welcome spoken,
// no re-prefill. Plus the restore hold rules and the copy tweaks.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { OutlineChat, composerText, introInHistory, outlineAsk, rememberComposer, sectionIntroLine } from "@/components/stages/loop/outline-chat";
import { STOCK_POOLS, alreadyAnswered, resumeLine } from "@/components/stages/loop/stance-chat";
import * as S from "@/lib/voice/speech";
import { setChatPref } from "@/lib/voice/prefs";
import { SIGNATURE_QUIP, STAGE2_QUIPS, quipFor } from "@/lib/coach/quips";
import { fillWelcome, WELCOME_BACK_LINES, WELCOME_BACK_TEMPLATES } from "@/lib/coach/welcome-back";
import type { LoopLine } from "@/lib/stages/stance-turn";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = function () {};
window.scrollTo = () => {};

const P = "p-race";
const S3 = `/app/papers/${P}/stage/3`;
const AAP = "The AAP says teens need 8 to 10 hours of sleep.";
const sections = [
  { key: "intro", title: "Introduction", needs: "Introduce the work", ideas: ["Later start helps."] },
  { key: "body", title: "Body", needs: "Develop the main examples", ideas: [AAP] },
  { key: "conclusion", title: "Conclusion", needs: "Close the paper", ideas: [] },
];
const [intro, body] = [sections[0]!, sections[1]!];
const history: LoopLine[] = [
  { k: "intro", who: "pau", text: outlineAsk(intro, false).slice(-2).join(" ") },
  { k: "intro", who: "you", text: "Claim: a later bell helps." },
  { k: "body", who: "pau", text: outlineAsk(body, false).slice(-2).join(" ") },
  { k: "body", who: "you", text: "Can you show me an example?" },
  { k: "body", who: "pau", text: "Sure. Start with your claim, then the example." },
];
const WELCOME = WELCOME_BACK_LINES[0];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let spoken: string[] = [];
function stubVoice() {
  class U {
    text: string;
    onstart?: () => void;
    onend?: () => void;
    constructor(t: string) {
      this.text = t;
    }
  }
  const synth = {
    paused: false,
    speak(u: U) {
      spoken.push(u.text);
      setTimeout(() => u.onstart?.(), 1);
      setTimeout(() => u.onend?.(), 2);
    },
    cancel() {},
    resume() {},
    getVoices: () => [],
    addEventListener() {},
  };
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: U, configurable: true });
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = class {
    start() {}
    stop() {}
    abort() {}
  };
  S.__browserVoiceForTest();
  S.__unlockForTest();
}

let root: Root | null = null;
let host: HTMLDivElement;
function mount(transcript: LoopLine[]) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const props = {
    paperId: P, persist: false, sections, done: ["intro"], transcript, aside: null,
    classify: async () => "content" as const, onAside: () => {}, flags: {}, saving: false, error: null,
    skipped: [], voiceNote: null, onSend: () => {}, onReopen: () => {}, onFinish: () => {}, onGoBack: () => {},
  };
  act(() => root!.render(createElement(OutlineChat, props)));
}
function unmount() {
  act(() => root?.unmount());
  root = null;
  host?.remove();
}
const count = (t: string) => (host.textContent ?? "").split(t).length - 1;
const click = (sel: string) => {
  const el = document.querySelector(sel) as HTMLElement | null;
  if (el) act(() => el.click());
};
const tapButton = (attr?: string) => {
  const b = document.createElement("button");
  if (attr) b.setAttribute(attr, "");
  document.body.append(b);
  b.click();
  b.remove();
};

beforeEach(() => {
  S.__resetSpeech();
  localStorage.clear();
  window.history.replaceState(null, "", S3);
  spoken = [];
  stubVoice();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  setChatPref("voice", true);
});
afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
});

describe("QA 5:44 PM: the reopen race", () => {
  it("remount + toggles during hydration: no duplicate intro, only the welcome spoken, no re-prefill", async () => {
    // The earlier visit: a send, then her body turn was read.
    S.armSpeech();
    S.takeNew(`${P}:stage3`, [{ key: "a", text: "old" }]);
    S.takeNew(`${P}:stage3`, [{ key: "b", text: outlineAsk(body, false).join(" "), turn: true }]);
    expect(S.currentTurn().length).toBe(1);
    rememberComposer(P, "body", "My own outline line.", AAP);
    // Dashboard, a tap there, back to the paper.
    window.history.replaceState(null, "", "/app");
    S.installSpeechUnlock();
    tapButton();
    window.history.replaceState(null, "", S3);
    spoken = [];
    mount([]);
    unmount();
    mount(history);
    expect(S.speechArmed()).toBe(false);
    click("[data-voice-toggle]");
    click("[data-voice-toggle]");
    click("[data-mic-mute]");
    click("[data-mic-mute]");
    act(() => document.body.click());
    S.unlockSpeech();
    unmount();
    mount(history);
    click("[data-voice-toggle]");
    click("[data-voice-toggle]");
    S.speak([WELCOME]);
    await wait(400);
    expect(count(sectionIntroLine(body))).toBe(1);
    // PC-28: a return opens a fresh chat; the locked intro section is not stacked above the current prompt.
    expect(count(sectionIntroLine(intro))).toBe(0);
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("My own outline line.");
    expect(spoken.length).toBeGreaterThan(0);
    // PC-28: her opener is one random welcome line naming the real sections.
    const anyWelcome = [WELCOME, ...WELCOME_BACK_TEMPLATES.map((t) => fillWelcome(t, { done: "outlining the Introduction", next: "the Body" }))].join(" ");
    expect(spoken.filter((t) => !anyWelcome.includes(t.trim()))).toEqual([]);
  });

  it("an intro already in history (by section id) is not said again; the box prefills once", () => {
    expect(introInHistory(history, body)).toBe(true);
    expect(introInHistory(history, sections[2]!)).toBe(false);
    expect(outlineAsk(body, false, true).join(" ")).not.toContain(sectionIntroLine(body));
    expect(composerText(P, "body", AAP)).toBe(AAP);
    rememberComposer(P, "body", "", AAP);
    expect(composerText(P, "body", AAP)).toBe("");
    mount(history);
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
    expect(composerText(P, "conclusion", "New saved note.")).toBe("New saved note.");
  });

  it("Stage 2: a turn already said and answered is never said again verbatim", () => {
    const ask = "Got a plan here? Or want me to grill you a little first? Nicely.";
    const t: LoopLine[] = [{ k: "body", who: "pau", text: ask }, { k: "body", who: "you", text: "My idea." }];
    expect(alreadyAnswered(t, "body", ask)).toBe(true);
    expect(alreadyAnswered(t, "intro", ask)).toBe(false);
    expect(alreadyAnswered(t.slice(0, 1), "body", ask)).toBe(false);
    expect(resumeLine("Body", true)).not.toContain(ask);
  });
});

describe("QA 5:44 PM: the restore hold", () => {
  it("only the welcome line; toggles, unlock, Mute and blank clicks never release it", async () => {
    S.installSpeechUnlock();
    S.beginRestoreHold();
    S.speak(["Let's shape your body (develop the main examples)."]);
    S.speak(["Restored turn."], { interrupt: true });
    S.unlockSpeech();
    tapButton("data-voice-toggle");
    tapButton("data-mic-mute");
    tapButton("data-tap-to-hear");
    document.body.click();
    expect(S.restoreHoldActive()).toBe(true);
    await wait(300);
    expect(spoken).toEqual([]);
    S.studentSent();
    expect(S.restoreHoldActive()).toBe(false);
  });
  it("a choice or chip tap IS a real action: it ends the hold and her reply to it is spoken (QA 6:18 PM)", async () => {
    S.installSpeechUnlock();
    S.beginRestoreHold();
    expect(S.restoreHoldActive()).toBe(true);
    const chip = document.createElement("button");
    chip.textContent = "Keep my notes";
    document.body.append(chip);
    chip.click();
    chip.remove();
    expect(S.restoreHoldActive()).toBe(false);
    expect(S.speechArmed()).toBe(true);
    S.takeNew(`${P}:stage3`, [{ key: "t1", text: "old" }]);
    const fresh = S.takeNew(`${P}:stage3`, [{ key: "t1", text: "old" }, { key: "t2", text: "Nice. On to your conclusion.", turn: true }]);
    S.speak(fresh.map((i) => i.text));
    await wait(300);
    expect(spoken).toEqual(["Nice.", "On to your conclusion."]);
  });
  it("ends when the welcome finishes playing; an explicit Read aloud tap still plays", async () => {
    S.beginRestoreHold(60_000);
    S.speak([WELCOME]);
    expect(S.restoreHoldActive()).toBe(true);
    await wait(600);
    expect(spoken).toEqual(WELCOME.split(/(?<=[.?!])\s+/));
    expect(S.restoreHoldActive()).toBe(false);
    S.beginRestoreHold();
    S.speak(["The turn I tapped."], { interrupt: true, explicit: true });
    await wait(300);
    expect(spoken).toContain("The turn I tapped.");
  });
  it("a dashboard tap never carries the arm into the paper; a stage-to-stage step does", () => {
    S.installSpeechUnlock();
    window.history.replaceState(null, "", "/app");
    tapButton();
    window.history.replaceState(null, "", S3);
    expect(S.speechArmed()).toBe(false);
    window.history.replaceState(null, "", `/app/papers/${P}/stage/2`);
    tapButton();
    window.history.replaceState(null, "", S3);
    expect(S.speechArmed()).toBe(true);
  });
});

describe("QA 5:44 PM: gates and copy", () => {
  it("chats render nothing until the restore completes; the outline box is read outside render", () => {
    const s1 = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(s1).toMatch(/if \(!paper \|\| resumePending \|\| !confirmReady\) \{/);
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    expect(loop).toMatch(/if \(!session\) \{\n\s*if \(!sessionLoaded\) \{/);
    const s3 = readFileSync("components/stages/loop/outline-chat.tsx", "utf8");
    expect(s3).toMatch(/useState<\{ key: string \| null; text: string \}>\(\(\) => \(\{/);
    expect(s3).not.toMatch(/!== forKey/);
  });
  it("the 'legally a cartoon' line is retired and never dealt", () => {
    expect(STAGE2_QUIPS).not.toContain(SIGNATURE_QUIP);
    for (const seed of ["a", "b", "paper-42"]) {
      expect(quipFor(seed, 0, "pick_lead")).toBeNull();
      const all = [0, 1, 2, 3, 4].flatMap((i) => [quipFor(seed, i, "pick_lead"), quipFor(seed, i, "logic_opener")]);
      expect(all.filter((q) => q === SIGNATURE_QUIP).length).toBe(0);
    }
    expect(Object.values(STOCK_POOLS).flat().join(" ")).not.toContain("legally a cartoon");
  });
  it("no outward-pointing quips; the welcome is warm, not 'Bold.'", () => {
    expect(STAGE2_QUIPS.join(" ")).not.toMatch(/Librarians live for this|Deadlines fear this energy/);
    expect(WELCOME_BACK_LINES.join(" ")).not.toMatch(/\bBold\b/);
  });
});
