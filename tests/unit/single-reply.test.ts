import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyRequirements, extractedField } from "@/lib/assignment/schema";
import {
  applyConfirmUpdates,
  appendStudentNote,
  emptyUpdates,
  isQuickConfirm,
  linkIn,
  parseConfirmTurns,
  parseModelResult,
  replayTurns,
  rulesClassify,
} from "@/lib/stage1/confirm-reply";
import { readBackParas, reconfirmParas, CONFIRM_INVITE } from "@/lib/stage1/pau-pau";
import { restartDelayMs, callStatusText } from "@/lib/voice/call";
import { chunkSentence, utteranceBudgetMs } from "@/lib/voice/speech";

const read = (p: string) => readFileSync(p, "utf8");

function card() {
  const req = emptyRequirements();
  req.course = extractedField("PSYC 101", 0.9);
  req.topic = extractedField("Social media and teen sleep", 0.9);
  req.length = extractedField({ wordsMin: 1200, wordsMax: 1200, raw: "1200 words" }, 0.9);
  req.citationStyle = extractedField("APA 7" as const, 0.9);
  req.dueDate = extractedField("Dec 12", 0.9);
  return req;
}

describe("A: one Pau Pau reply per turn", () => {
  it("PauPauGroup renders every paragraph inside ONE bubble", () => {
    const src = read("components/stages/stage1/chat-bubbles.tsx");
    const group = src.slice(src.indexOf("export function PauPauGroup"), src.indexOf("export type SentAttachment"));
    expect(group.match(/className=\{cn\(BUBBLE/g)).toHaveLength(1);
    expect(group).toContain("data-pau-turn");
  });
  it("greeting and first question are one reply, also in rebuilt history", () => {
    const src = read("components/stages/stage1/assignment-intake.tsx");
    expect(src).not.toContain("<PauPauBubble>{ASSIGNMENT_GREETING}</PauPauBubble>");
    expect(src.match(/bubbles=\{\[ASSIGNMENT_GREETING, ASSIGNMENT_ASK\]\}/g)!.length).toBeGreaterThanOrEqual(3);
  });
  it("intro and the first question share one reply", () => {
    const src = read("components/stages/stage1/assignment-intake.tsx");
    expect(src).toContain("bubbles={i === 0 ? [...INTRO_BUBBLES, item.text] : [item.text]}");
    expect(src).toContain("...(!editing && q.id === coachingPlan[0]?.id ? INTRO_BUBBLES : [])");
    expect(src).not.toContain("<PauPauGroup bubbles={INTRO_BUBBLES} />");
  });
  it("the hesitation offer, its choices and the answer are one reply", () => {
    const src = read("components/stages/stage1/hesitation.tsx");
    expect(src.match(/<PauPauGroup/g)).toHaveLength(1);
    expect(src).not.toContain("PauPauBubble");
  });
  it("the read-back is one reply that ends with the invitation to answer", () => {
    const paras = readBackParas(card(), { seed: "x" });
    expect(paras.length).toBeLessThanOrEqual(3);
    expect(paras.at(-1)).toContain(CONFIRM_INVITE);
    expect(paras.join(" ")).toMatch(/PSYC 101/);
  });
});

describe("B: no stage sidebar inside a paper", () => {
  it("stage shell uses the slim progress row", () => {
    const shell = read("components/stages/stage-shell.tsx");
    expect(shell).not.toContain("StageRail");
    expect(shell).toContain("<StageProgress");
    const bar = read("components/stages/stage-progress.tsx");
    expect(bar).not.toMatch(/six-stage coach/i);
    expect(bar).toContain("min-h-[48px]");
    expect(bar).toContain('aria-current={active ? "step" : undefined}');
  });
});

describe("C: natural replies instead of Fix something", () => {
  it("the confirm screen has no Fix something / Let's go buttons", () => {
    const src = read("components/stages/stage1/pau-pau-confirm.tsx");
    expect(src).not.toContain("Fix something");
    expect(src).not.toContain("Let's go");
    expect(src).toContain("<ChatComposer");
  });
  it("plain confirms are recognized without a model call", () => {
    for (const t of ["looks good", "Yes", "yep, that's right", "Looks good to me.", "let's go", "all good", "perfect"]) {
      expect(isQuickConfirm(t), t).toBe(true);
    }
    for (const t of ["looks good but it's 1500 words", "do you need my due date?", "hmm", "no", "maybe"]) {
      expect(isQuickConfirm(t), t).toBe(false);
    }
  });
  it("rules: a correction updates fields, a question is answered, unclear never confirms", () => {
    const c = rulesClassify("it's actually 1500 words, due Dec 3", null);
    expect(c.intent).toBe("correction");
    expect(c.updates.wordsMin).toBe(1500);
    expect(c.updates.dueDate).toBe("Dec 3");
    expect(rulesClassify("do you need my due date?", null).intent).toBe("question");
    expect(rulesClassify("hmm idk", null).intent).toBe("ambiguous");
    expect(rulesClassify("I don't have them yet", "sources").skipAsk).toBe(true);
    expect(rulesClassify("it's MLA not APA", null).updates.citationStyle).toBe("MLA 9");
  });
  it("model results: confirm with changes becomes a correction; empty correction becomes ambiguous", () => {
    const u = { ...emptyUpdates(), wordsMin: 1500 };
    expect(parseModelResult({ intent: "confirm", reply: "Great!", updates: u, keepAsNote: false, skipAsk: false })!.intent).toBe("correction");
    expect(parseModelResult({ intent: "correction", reply: "Okay.", updates: emptyUpdates(), keepAsNote: false, skipAsk: false })!.intent).toBe("ambiguous");
    expect(parseModelResult({ intent: "nope", reply: "x", updates: {} })).toBeNull();
    expect(parseModelResult({ intent: "question", reply: "Sure!", updates: {}, keepAsNote: false, skipAsk: false })!.reply).toBe("Sure.");
  });
  it("corrections land on the card as student-confirmed values and Pau Pau re-confirms", () => {
    const next = applyConfirmUpdates(card(), { ...emptyUpdates(), wordsMin: 1500, dueDate: "Dec 3" });
    expect(next.length.value?.wordsMin).toBe(1500);
    expect(next.length.confirmed).toBe(true);
    expect(next.dueDate.value).toMatch(/^Dec 3, 20\d\d$/);
    const paras = reconfirmParas(next, null);
    expect(paras.join(" ")).toMatch(/1,500/);
    expect(paras.at(-1)).toMatch(/look right now/i);
  });
  it("extra info keeps the student's words verbatim", () => {
    const next = appendStudentNote(card(), "My teacher said first person is fine.");
    expect(next.otherInstructions.value).toContain("My teacher said first person is fine.");
  });
  it("a reload replays saved corrections onto the card", () => {
    const turns = parseConfirmTurns(
      JSON.stringify([
        { role: "pau", paras: ["read-back"] },
        { role: "student", text: "it's 1500 words" },
        { role: "pau", paras: ["Got it."], apply: { updates: { ...emptyUpdates(), wordsMin: 1500 } } },
        { role: "bogus" },
      ]),
    );
    expect(turns).toHaveLength(3);
    expect(replayTurns(card(), turns).length.value?.wordsMin).toBe(1500);
  });
  it("finds a link in a reply", () => {
    expect(linkIn("here: https://example.com/a.pdf.")).toBe("https://example.com/a.pdf");
    expect(linkIn("no link")).toBeNull();
  });
  it("the reply route skips the model for plain confirms and is coaching-only", () => {
    const route = read("app/api/papers/[paperId]/assignment/reply/route.ts");
    expect(route).toContain("if (isQuickConfirm(body.message))");
    const lib = read("lib/stage1/confirm-reply.ts");
    expect(lib).toMatch(/never write any part of the student's paper/);
    expect(lib).toMatch(/Never treat an unclear reply as confirm/);
  });
});

describe("D: mobile voice", () => {
  afterEach(() => {
    const g = globalThis as Record<string, unknown>;
    delete g.window;
    delete g.SpeechSynthesisUtterance;
    vi.restoreAllMocks();
  });

  function fakeSynth(opts: { endEvents?: boolean; startEvents?: boolean } = {}) {
    const spoken: string[] = [];
    class U {
      text: string;
      volume = 1;
      rate = 1;
      lang = "";
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(t: string) {
        this.text = t;
      }
    }
    const synth = {
      paused: false,
      speak(u: U) {
        spoken.push(u.text);
        if (opts.startEvents !== false) setTimeout(() => u.onstart?.(), 0);
        if (opts.endEvents !== false) setTimeout(() => u.onend?.(), 0);
      },
      cancel() {},
      resume() {},
      getVoices: () => [],
    };
    const g = globalThis as Record<string, unknown>;
    g.window = { speechSynthesis: synth, SpeechSynthesisUtterance: U };
    g.SpeechSynthesisUtterance = U;
    return spoken;
  }

  it("holds Pau Pau's words until the first tap on phones, then plays them", async () => {
    const spoken = fakeSynth();
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: false } });
    const mod = await import("@/lib/voice/speech");
    mod.__resetSpeech();
    mod.speak(["Hi, I'm Pau Pau."]);
    await new Promise((r) => setTimeout(r, 20));
    expect(spoken).toEqual([]);
    mod.unlockSpeech();
    await new Promise((r) => setTimeout(r, 120));
    expect(spoken[0]).toBe(" "); // the silent unlock utterance, inside the tap
    expect(spoken).toContain("Hi, I'm Pow pow.");
    mod.stopSpeech();
  });

  it("a missing onend can't stall the queue (watchdog)", async () => {
    vi.useFakeTimers();
    const spoken = fakeSynth({ endEvents: false });
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
    const mod = await import("@/lib/voice/speech");
    mod.__resetSpeech();
    mod.speak(["One. Two."]);
    vi.advanceTimersByTime(100);
    expect(spoken).toEqual(["One."]);
    vi.advanceTimersByTime(utteranceBudgetMs("One.") + 200);
    expect(spoken).toEqual(["One.", "Two."]);
    mod.stopSpeech();
    vi.useRealTimers();
  });

  it("long sentences are chunked for Chrome's cutoff", () => {
    const long = Array.from({ length: 30 }, (_, i) => `part ${i}`).join(", ") + ".";
    const chunks = chunkSentence(long, 60);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.length <= 90)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(long);
  });

  it("call helpers: restart backoff and fallback text", () => {
    expect(restartDelayMs(1)).toBe(250);
    expect(restartDelayMs(10)).toBe(4000);
    expect(callStatusText("unsupported")).toMatch(/type your reply/);
    expect(callStatusText("blocked")).toMatch(/blocked/);
  });

  it("voice call: listens between turns, pauses while Pau Pau talks, auto-sends, mute persists", () => {
    const src = read("components/stages/stage1/chat-composer.tsx");
    expect(src).toMatch(/const wantListen =\s*callOn && !micMuted && !speaking && !sending/);
    expect(src).toContain("SILENCE_SEND_MS");
    expect(src).toContain("sendRef.current();");
    expect(src).toMatch(/rec\.onend = \(\) => \{[\s\S]{0,900}startCallSession\(\)/);
    expect(src).toContain("unlockSpeech();");
    expect(read("lib/voice/prefs.ts")).toContain('micMuted: "pau_mic_muted"');
    const voice = read("components/stages/stage1/voice.tsx");
    expect(voice).toContain("export function MicMuteButton");
    expect(voice).toMatch(/if \(next\) \{\s*\/\/[^\n]*\n\s*unlockSpeech\(\);/);
  });
});

describe("C: Pau Pau doesn't nag", () => {
  it("an ask (sources/length) is made once; after that the re-confirm asks 'does that look right now?'", () => {
    const src = read("components/stages/stage1/pau-pau-confirm.tsx");
    expect(src).toContain("function askedBefore()");
    expect(src).toContain("reconfirmParas(next, nextNewAsk(next, after))");
    expect(read("lib/stage1/confirm-reply.ts")).toMatch(/Do not end with a question/);
  });
});
