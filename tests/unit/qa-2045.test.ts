// QA 8:45 PM polish: no repeated "Your call is below.", demo Voice-on reads the
// greeting once, a thin demo banner, a noticeable demo files note, one
// mic-blocked message.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { resumeLine, sectionResume } from "@/components/stages/loop/stance-chat";
import { appendLines } from "@/lib/stages/stance-turn";
import { setLocalUser } from "@/lib/local/user-scope";
import { __resetSpeech, currentTurn, takeNew, takeVisitOpener } from "@/lib/voice/speech";
import { callStatusText } from "@/lib/voice/call";

const read = (p: string) => readFileSync(p, "utf8");

describe("#1 the canned resume line is said once per section", () => {
  it("first time it shows; once said in the section, she stays silent", () => {
    const line = resumeLine("Body", false);
    expect(line).toBe("Back to your body. Your call is below.");
    expect(sectionResume([], "body", "Body", false)).toEqual([line]);
    const t = [
      { k: "body", who: "pau" as const, text: line },
      { k: "body", who: "you" as const, text: "Keep it." },
    ];
    expect(sectionResume(t, "body", "Body", false)).toEqual([]);
    // Another section still gets its own line once.
    expect(sectionResume(t, "conclusion", "Conclusion", false)).toEqual([resumeLine("Conclusion", false)]);
    // An empty turn adds no blank line to the transcript.
    expect(appendLines(t, [{ k: "body", who: "pau", text: "" }, { k: "body", who: "you", text: "x" }])).toHaveLength(3);
  });
  it("Stage 2 uses it and never sends paras[0] undefined", () => {
    const chat = read("components/stages/loop/stance-chat.tsx");
    expect(chat).toContain("const paras = said ? sectionResume(transcript, section.key, section.title, freeText) : paras0;");
    expect(chat).not.toContain("pau(paras[0]!)");
  });
});

describe("#2 demo: Voice on reads the greeting once when nothing was said yet", () => {
  afterEach(() => {
    __resetSpeech();
    setLocalUser(null);
  });
  it("demo + opener on screen: once; then nothing", () => {
    __resetSpeech();
    setLocalUser("demo");
    takeNew("p1", [{ key: "ask", text: "Hi, I'm Pau Pau. What's the assignment?", turn: true, opener: true }]);
    expect(currentTurn()).toEqual(["Hi, I'm Pau Pau. What's the assignment?"]);
    expect(currentTurn()).toEqual([]);
  });
  it("a return with student turns flags no opener, so old turns are never replayed", () => {
    __resetSpeech();
    setLocalUser("demo");
    takeNew("p1", [{ key: "s2:intro", text: "Introduction. Hook the reader.", opener: false }, { key: "t", text: "Old turn.", turn: true }]);
    expect(takeVisitOpener()).toEqual([]);
  });
  it("signed-in users are unchanged", () => {
    __resetSpeech();
    setLocalUser("user-1");
    takeNew("p1", [{ key: "ask", text: "Hi.", opener: true }]);
    expect(takeVisitOpener()).toEqual([]);
  });
  it("wired: the Voice switch falls back to the opener; openers are flagged only without student turns", () => {
    expect(read("components/stages/stage1/voice.tsx")).toContain("speak(currentTurn(), { interrupt: true });");
    const speech = read("lib/voice/speech.ts");
    expect(speech).toMatch(/const opener = takeVisitOpener\(\);\s*if \(opener\.length\) explicitTapAt = Date\.now\(\);/);
    expect(speech).toMatch(/if \(texts\.some\(\(t\) => t\.trim\(\)\)\) spokeThisVisit = true;/);
    expect(read("components/stages/stage1/assignment-intake.tsx")).toContain("turn: !error, opener: true");
    expect(read("components/stages/loop/stance-chat.tsx")).toContain('opener: !transcript.some((l) => l.who !== "pau")');
  });
});

describe("#3/#4 demo banner and files note", () => {
  it("banner is one thin line with 48px targets", () => {
    const b = read("components/app/demo-loss-banner.tsx");
    expect(b).toContain("min-h-[48px]");
    expect(b).toContain("truncate");
    expect(b).not.toMatch(/py-3|flex-wrap/);
    expect(b).toMatch(/aria-label="Dismiss"[\s\S]*h-12 w-12/);
  });
  it("files note is a calm card in ink text, not muted 13px", () => {
    const s = read("components/stages/stage1/assignment-intake.tsx");
    const note = s.slice(s.indexOf("data-demo-files-note") - 200, s.indexOf("data-demo-files-note") + 400);
    expect(note).toContain("text-ds-ink");
    expect(note).toContain("<Info aria-hidden");
    expect(note).not.toContain("text-ds-accent");
  });
});

describe("#5 mic blocked: one message", () => {
  const c = read("components/stages/stage1/chat-composer.tsx");
  it("blocked wins over 'unsupported' and voice typing uses the same text", () => {
    expect(c).toMatch(/: micBlocked\s*\? micMuted && canDictate\s*\? "muted"\s*: "blocked"\s*: !canDictate/);
    expect(c).toMatch(/denied\s*\? callStatusText\("blocked"\)/);
    expect(c).not.toContain("The microphone is blocked. Allow it in your browser settings");
    expect(c).toContain('query({ name: "microphone" as PermissionName })');
    expect(callStatusText("blocked")).toBe("Mic blocked. Allow it in your browser, or type.");
  });
});
