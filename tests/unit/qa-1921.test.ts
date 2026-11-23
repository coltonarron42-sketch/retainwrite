// QA 7:21 PM: smooth, quick voice. One clip per thought (first sentence alone
// for a fast start, the rest as one clip), trimmed seams, a shorter silence
// wait, Mute on the composer, demo audio capped, and the return/replay hold
// still intact with grouped clips.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SILENCE_INTERIM_MS, SILENCE_SEND_MS } from "@/lib/voice/call";
import { GROUP_MAX_CHARS, KEEP_LEAD_S, KEEP_TAIL_S, silenceTrim, splitGroup, voiceGroups } from "@/lib/voice/speech";
import { DEMO_TTS_LIMIT, DEMO_TTS_WINDOW_MS, demoTtsAllowed } from "@/lib/voice/demo-tts-limit";
import { unsentSection } from "@/components/stages/loop/coaching-loop";
import { WELCOME_BACK_LINES } from "@/lib/coach/welcome-back";

const read = (p: string) => readFileSync(p, "utf8");
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("one continuous thought", () => {
  it("first sentence alone, the rest of the turn as one clip", () => {
    expect(voiceGroups(["That's a real story, honestly.", "What happened that month?", "Tell me anything you noticed."])).toEqual([
      "That's a real story, honestly.",
      "What happened that month? Tell me anything you noticed.",
    ]);
    expect(voiceGroups(["Okay.", "Your claim is clear.", "Want to keep it?"])).toEqual(["Okay. Your claim is clear.", "Want to keep it?"]);
    expect(voiceGroups(["Just one."])).toEqual(["Just one."]);
    const many = Array.from({ length: 12 }, (_, i) => `This is sentence number ${i} of a long turn here.`);
    const g = voiceGroups(many);
    expect(g.length).toBeLessThanOrEqual(3);
    for (const clip of g) expect(clip.length).toBeLessThanOrEqual(GROUP_MAX_CHARS);
    expect(g.join(" ")).toBe(many.join(" "));
  });
  it("the browser voice still reads a grouped clip sentence by sentence", () => {
    expect(splitGroup("What happened that month? Tell me anything you noticed.")).toEqual(["What happened that month?", "Tell me anything you noticed."]);
  });
  it("seams lose the clip's own silence but keep a short breath", () => {
    const rate = 1000;
    const pcm = new Float32Array(750);
    for (let i = 150; i < 450; i++) pcm[i] = 0.3;
    const t = silenceTrim(pcm, rate)!;
    expect(t.lead).toBeCloseTo(0.15 - KEEP_LEAD_S, 3);
    expect(t.end).toBeCloseTo(0.449 + KEEP_TAIL_S, 2);
    expect(silenceTrim(new Float32Array(100), rate)).toBeNull();
  });
});

describe("quicker turn-taking", () => {
  it("sends after ~0.85 s of silence; longer while words are still in progress", () => {
    expect(SILENCE_SEND_MS).toBeGreaterThanOrEqual(700);
    expect(SILENCE_SEND_MS).toBeLessThanOrEqual(900);
    expect(SILENCE_INTERIM_MS).toBeGreaterThan(SILENCE_SEND_MS);
    expect(SILENCE_INTERIM_MS).toBeLessThanOrEqual(1600);
    expect(read("components/stages/stage1/chat-composer.tsx")).toMatch(/interims\.some\(\(t\) => t\.trim\(\)\) \? SILENCE_INTERIM_MS : SILENCE_SEND_MS/);
  });
});

describe("Mute lives on the composer, by the mic", () => {
  it("not in the header; a 48px round mic button in the composer row on a voice call", () => {
    const voice = read("components/stages/stage1/voice.tsx");
    const header = voice.slice(voice.indexOf("export function ChatHeader"), voice.indexOf("export function SpeakNew"));
    expect(header).not.toContain("MicMuteButton");
    expect(voice).toMatch(/compact\s*\n?\s*\? "ds-focus flex h-12 w-12/);
    const composer = read("components/stages/stage1/chat-composer.tsx");
    expect(composer).toContain("{callOn ? <MicMuteButton compact /> : null}");
    expect(voice).toMatch(/aria-label=\{micMuted \? "Unmute your mic" : "Mute your mic"\}/);
  });
});

describe("demo always has audio", () => {
  it("the TTS route serves demo sessions, capped per session", () => {
    const route = read("app/api/voice/tts/route.ts");
    expect(route).toMatch(/if \(demo\) \{[\s\S]{0,300}demoTtsAllowed/);
    const key = `k-${Math.random()}`;
    for (let i = 0; i < DEMO_TTS_LIMIT; i++) expect(demoTtsAllowed(key, 1000)).toBe(true);
    expect(demoTtsAllowed(key, 1000)).toBe(false);
    expect(demoTtsAllowed(key, 1000 + DEMO_TTS_WINDOW_MS + 1)).toBe(true);
  });
  it("a refused clip falls back to the browser voice", () => {
    const speech = read("lib/voice/speech.ts");
    expect(speech).toMatch(/res\.status === 503 \|\| res\.status === 401/);
    expect(speech).toMatch(/else if \(synthSupported\(\)\) speakWithSynth\(next, gen\)/);
  });
});

describe("Stage 2 unsent note: the section it was left in", () => {
  it("opens the first section with an unsent note", () => {
    const notes: Record<string, string> = { body: "", conclusion: "half a thought" };
    expect(unsentSection(["intro", "body", "conclusion"], (k) => notes[k] ?? "")).toBe(2);
    expect(unsentSection(["intro"], () => "")).toBe(-1);
  });
});

/* ---- grouped clips through one <audio>, gapless seams, and the hold ---- */
type H = (() => void) | null;
class FakeAudio {
  static instances: FakeAudio[] = [];
  src = "";
  muted = false;
  preload = "";
  currentTime = 0;
  playbackRate = 1;
  onplaying: H = null;
  onended: H = null;
  onerror: H = null;
  paused = true;
  constructor() {
    FakeAudio.instances.push(this);
  }
  setAttribute() {}
  play() {
    this.paused = false;
    if (!this.src.startsWith("data:")) setTimeout(() => this.onplaying?.(), 5);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}
function setup() {
  const pcm = new Float32Array(750);
  for (let i = 150; i < 450; i++) pcm[i] = 0.3;
  class Offline {
    async decodeAudioData() {
      return { sampleRate: 1000, getChannelData: () => pcm };
    }
  }
  const synth = { paused: false, speak() {}, cancel() {}, resume() {}, getVoices: () => [] };
  vi.stubGlobal("window", { Audio: FakeAudio, OfflineAudioContext: Offline, speechSynthesis: synth, SpeechSynthesisUtterance: class {}, addEventListener() {}, location: { pathname: "/app/papers/p/stage/2" } });
  vi.stubGlobal("document", { addEventListener() {}, visibilityState: "visible" });
  vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body).text);
    return { status: 200, ok: true, blob: async () => ({ size: 10, arrayBuffer: async () => new ArrayBuffer(8) }) };
  });
  URL.createObjectURL = (() => `blob:clip-${calls.length}`) as typeof URL.createObjectURL;
  return { calls };
}

describe("grouped playback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeAudio.instances = [];
  });
  it("two requests for a three-sentence turn; skips lead silence; hands over at the words' end", async () => {
    const { calls } = setup();
    const m = await import("@/lib/voice/speech");
    m.__resetSpeech();
    m.unlockSpeech();
    m.speak(["That's a real story, honestly. What happened that month? Tell me anything you noticed."]);
    await tick(40);
    expect(calls).toEqual(["That's a real story, honestly.", "What happened that month? Tell me anything you noticed."]);
    const a = FakeAudio.instances[0]!;
    expect(a.currentTime).toBeCloseTo(0.12, 2); // started past the clip's lead silence
    expect(m.audibleSentence()).toBe("That's a real story, honestly.");
    // No 'ended' needed: at the words' end (~0.41 s in) the next clip starts.
    await tick(480);
    expect(m.audibleSentence()).toBe("What happened that month? Tell me anything you noticed.");
    m.stopSpeech();
  });
  it("the restore hold still drops everything but the welcome (one clip) and an explicit replay", async () => {
    const { calls } = setup();
    const m = await import("@/lib/voice/speech");
    m.__resetSpeech();
    m.unlockSpeech();
    m.beginRestoreHold();
    m.speak(["Restored turn one. Restored turn two."]);
    await tick(20);
    expect(calls).toEqual([]);
    const welcome = WELCOME_BACK_LINES[2];
    m.speak([welcome]);
    await tick(40);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.join(" ")).toBe(welcome);
    expect(m.restoreHoldActive()).toBe(true);
    m.stopSpeech();
    m.speak(["Read aloud on tap."], { explicit: true });
    await tick(150); // a beat after cancel, then it plays
    expect(calls.at(-1)).toBe("Read aloud on tap.");
    m.stopSpeech();
  });
});
