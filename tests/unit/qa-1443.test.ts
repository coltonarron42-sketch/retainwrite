import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PAU_PERSONALITY, SAMPLE_QUIPS } from "@/lib/coach/personality";
import { CONFIRM_REPLY_SYSTEM } from "@/lib/stage1/confirm-reply";
import { SPARK_SYSTEM } from "@/lib/stage1/spark";
import { callStatusText } from "@/lib/voice/call";

const read = (p: string) => readFileSync(p, "utf8");

describe("2:43 #1 the locked Pau character", () => {
  it("blob head on cream, pink cat-eye glasses, dark eyes inside the frames, tiny smile", async () => {
    const { PauFace, PAU_COLORS } = await import("@/components/stages/stage1/pau-presence");
    const html = renderToStaticMarkup(createElement(PauFace, { alive: true }));
    for (const c of Object.values(PAU_COLORS)) expect(html).toContain(c);
    expect(html).toContain('data-pau-character="blob-glasses"');
    expect((html.match(/clip-path="url\(#pp-[lr]-/g) ?? []).length).toBe(2); // eyes stay inside the frames
    expect(html).toContain('class="pp-blink"');
    expect((html.match(/class="pp-glance"/g) ?? []).length).toBe(2);
    expect(html).not.toMatch(/fill-ds-ink/); // the old teal/ink face is gone
  });
  it("still under reduced motion: blink/glance only animate under no-preference", () => {
    const css = read("app/globals.css");
    const motion = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(motion).toMatch(/\.pp-blink\s*\{\s*animation: pp-blink/);
    expect(css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"))).not.toMatch(/animation: pp-(blink|glance)/);
  });
  it("one face component everywhere (header, bubble avatar)", () => {
    expect(read("components/stages/stage1/voice.tsx")).toMatch(/<PauFace alive/);
    expect(read("components/stages/stage1/chat-bubbles.tsx")).toMatch(/<PauFace alive=\{alive\}/);
  });
});

describe("2:43 #2 cleaner chat: no bubble boxes", () => {
  const src = read("components/stages/stage1/chat-bubbles.tsx");
  it("Pau's turns are plain text (no border, shadow or card)", () => {
    const bubble = src.match(/const BUBBLE = "([^"]*)"/)?.[1] ?? "";
    expect(bubble).not.toMatch(/border|shadow|bg-|rounded/);
  });
  it("student turns are a light right-aligned block with a thin rule", () => {
    const student = src.match(/const STUDENT = "([^"]*)"/)?.[1] ?? "";
    expect(student).toMatch(/border-r-2/);
    expect(student).not.toMatch(/bg-|shadow|rounded/);
  });
  it("waves still sit around her current turn, absolutely placed", () => {
    expect(src).toMatch(/<SpeakingWaves active=\{speaking\} \/>/);
  });
});

describe("2:43 #4 personality", () => {
  it("every Pau-voiced prompt carries the personality and the coaching-only rule", () => {
    for (const sys of [CONFIRM_REPLY_SYSTEM, SPARK_SYSTEM]) {
      expect(sys).toContain(PAU_PERSONALITY);
      expect(sys).toMatch(/never write any part of (the student's|their) paper/i);
    }
    expect(PAU_PERSONALITY).toMatch(/At most ONE small quip/);
    expect(PAU_PERSONALITY).toMatch(/never at the student's expense/);
    expect(PAU_PERSONALITY).toMatch(/sensitive topics[^.]*skip the jokes/);
  });
  it("static quips are short and kind", () => {
    for (const q of SAMPLE_QUIPS) {
      expect(q.split(" ").length).toBeLessThanOrEqual(6);
      expect(q).not.toMatch(/\byou(r)?\b/i); // teases the situation, never the student
    }
  });
});

/* ---- #3 audio: server voice through <audio>, real playback events ---- */
type H = (() => void) | null;
class FakeAudio {
  static blockPlay = false;
  static instances: FakeAudio[] = [];
  src = "";
  muted = false;
  preload = "";
  onplaying: H = null;
  onended: H = null;
  onerror: H = null;
  paused = true;
  constructor() {
    FakeAudio.instances.push(this);
  }
  setAttribute() {}
  play() {
    if (FakeAudio.blockPlay && !this.src.startsWith("data:")) {
      const e = new Error("blocked");
      e.name = "NotAllowedError";
      return Promise.reject(e);
    }
    this.paused = false;
    if (!this.src.startsWith("data:")) setTimeout(() => this.onplaying?.(), 5);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

function setup(ttsStatus = 200) {
  const spoken: string[] = [];
  class U {
    text: string;
    onstart: H = null;
    onend: H = null;
    onerror: H = null;
    volume = 1;
    constructor(t: string) {
      this.text = t;
    }
  }
  const synth = { paused: false, speak(u: U) { spoken.push(u.text); setTimeout(() => u.onstart?.(), 0); setTimeout(() => u.onend?.(), 10); }, cancel() {}, resume() {}, getVoices: () => [] };
  vi.stubGlobal("window", { Audio: FakeAudio, speechSynthesis: synth, SpeechSynthesisUtterance: U, addEventListener() {} });
  vi.stubGlobal("SpeechSynthesisUtterance", U);
  vi.stubGlobal("document", { addEventListener() {}, visibilityState: "visible" });
  vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body).text);
    return { status: ttsStatus, ok: ttsStatus === 200, blob: async () => ({ size: 10 }) };
  });
  URL.createObjectURL = (() => `blob:clip-${calls.length}`) as typeof URL.createObjectURL;
  return { spoken, calls };
}
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("2:43 #3 mobile audio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeAudio.blockPlay = false;
    FakeAudio.instances = [];
  });
  it("plays server clips through one <audio>; 'audible' comes from the playing event", async () => {
    const { calls } = setup();
    const m = await import("@/lib/voice/speech");
    m.__resetSpeech();
    m.unlockSpeech();
    m.speak(["Hi there. Second line."]);
    expect(m.audibleSentence()).toBeNull(); // queued is not talking
    await tick(30);
    expect(calls[0]).toBe("Hi there.");
    expect(m.audibleSentence()).toBe("Hi there.");
    expect(m.voiceEngine()).toBe("server");
    FakeAudio.instances[0]!.onended?.();
    await tick(30);
    expect(m.audibleSentence()).toBe("Second line.");
    m.stopSpeech();
    expect(m.audibleSentence()).toBeNull();
  });
  it("blocked playback: never claims she's talking, shows 'Tap to hear', and the tap replays", async () => {
    setup();
    const m = await import("@/lib/voice/speech");
    m.__resetSpeech();
    FakeAudio.blockPlay = true;
    m.speak(["Hello."]);
    await tick(30);
    expect(m.audibleSentence()).toBeNull();
    expect(m.isSpeaking()).toBe(false);
    expect(m.needsTap()).toBe(true);
    FakeAudio.blockPlay = false;
    m.unlockSpeech();
    await tick(30);
    expect(m.needsTap()).toBe(false);
    expect(m.audibleSentence()).toBe("Hello.");
    m.stopSpeech();
  });
  it("no server voice (503): falls back to Web Speech", async () => {
    const { spoken } = setup(503);
    const m = await import("@/lib/voice/speech");
    m.__resetSpeech();
    m.speak(["Fallback works."]);
    await tick(30);
    expect(spoken).toContain("Fallback works.");
    expect(m.voiceEngine()).toBe("browser");
    m.stopSpeech();
  });
  it("status copy never says she's talking before sound starts", () => {
    expect(callStatusText("starting")).not.toMatch(/talking/i);
    const composer = read("components/stages/stage1/chat-composer.tsx");
    expect(composer).toMatch(/speaking\s*\?\s*audible\s*\?\s*"paused"\s*:\s*"starting"/);
    expect(read("components/stages/stage1/voice.tsx")).toMatch(/if \(voice && blocked\) return <TapToHear/);
  });
  it("the TTS route uses xAI text to speech with the existing key and never logs it", () => {
    const route = read("app/api/voice/tts/route.ts");
    expect(route).toContain("https://api.x.ai/v1/tts");
    expect(route).toMatch(/process\.env\.GROK_API_KEY/);
    expect(route).not.toMatch(/console\.[a-z]+\([^)]*key/);
    expect(route).toMatch(/status: 401/);
  });
});
