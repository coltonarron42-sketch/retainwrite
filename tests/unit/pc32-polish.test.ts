/** PC-32 polish (QA 6:44 PM should-fixes). */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BACKGROUND_LABEL, asksForExamples, dequote, readingCatalog, readingLead, shapeStructuredAnswer } from "@/lib/coach/answer";
import type { LoopLine } from "@/lib/stages/stance-turn";

vi.mock("@/components/stages/stage1/welcome-back", async (orig) => ({
  ...(await orig<typeof import("@/components/stages/stage1/welcome-back")>()),
  // A return visit: the focused one-exchange view (#63).
  useFocusReturn: () => ({ focused: true, line: "Welcome back.", index: 0 }),
}));

const ctx = {
  summaries: [
    { kind: "knowledge", title: "“What Makes a Leader?”", points: ["Goleman argues that emotional intelligence sets the best leaders apart."] },
    { kind: "knowledge", title: "Northouse's Leadership: Theory and Practice (the book overall)", points: ["The book surveys the major approaches: trait, behavioral (task vs. relationship), situational, transformational and servant leadership."] },
  ],
  missing: ["HBR article 'What Makes a Leader?' by Daniel Goleman", "Northouse's Leadership: Theory and Practice, Ch. 4"],
};
const readings = readingCatalog(ctx);
const goleman = readings.find((r) => r.author === "Goleman")!;
const northouse = readings.find((r) => r.author === "Northouse")!;
const WALTON_FACTS = ["Sam Walton opened the first Walmart in 1962 in Rogers, Arkansas.", "Walton famously drove an old pickup truck to work."];

describe("#1 a concept question stays with the readings and explain", () => {
  const raw = {
    explain: "A leadership style is the pattern of how a leader acts with people.",
    readingPoints: [
      { text: "The book surveys the major approaches: trait, behavioral (task vs. relationship), situational, transformational and servant leadership.", readingId: northouse.id },
      { text: "Goleman argues that emotional intelligence sets the best leaders apart.", readingId: goleman.id },
    ],
    leaderFacts: WALTON_FACTS,
    question: "Which of those styles fits your leader?",
  };
  it("'What are the main leadership styles?' gets no Walton background block", () => {
    const o = shapeStructuredAnswer({ raw, readings, leader: "Sam Walton", message: "What are the main leadership styles?" });
    const text = o.paras.join("\n");
    expect(text).not.toContain(BACKGROUND_LABEL);
    expect(text).not.toMatch(/1962|pickup/);
    expect(text).toContain("From your Northouse chapter:");
    expect(text).toContain("From your Goleman article:");
  });
  it("a leader question or an examples question still gets the facts", () => {
    expect(shapeStructuredAnswer({ raw, readings, leader: "Sam Walton", message: "How did Sam Walton show servant leadership?" }).paras.join(" ")).toContain(BACKGROUND_LABEL);
    expect(shapeStructuredAnswer({ raw, readings, leader: "Sam Walton", message: "Who are some examples of servant leaders?" }).paras.join(" ")).toContain("1962");
  });
  it("examples detector", () => {
    expect(asksForExamples("Who are some examples of servant leaders?")).toBe(true);
    expect(asksForExamples("Which leaders used transformational leadership?")).toBe(true);
    expect(asksForExamples("What are the main leadership styles?")).toBe(false);
    expect(asksForExamples("What is emotional intelligence?")).toBe(false);
  });
});

describe("#2 reading labels: author plus type, never doubled quotes", () => {
  it("a title with no name takes the author from its key points and merges with the sheet's entry", () => {
    expect(readings).toHaveLength(2);
    expect(readingLead(goleman)).toBe("From your Goleman article:");
    expect(readingLead(northouse)).toBe("From your Northouse chapter:");
  });
  it("the fallback is de-quoted", () => {
    const lead = readingLead({ id: "r1", title: "“What Makes a Leader?”", author: null, noun: "article", points: "" });
    expect(lead).toBe("From your reading, What Makes a Leader?:");
    expect(lead).not.toMatch(/["“”]/);
    expect(readingLead({ id: "r1", title: "", author: null, noun: "reading", points: "" })).toBe("From your reading:");
    expect(dequote("'What Makes a Leader?'")).toBe("What Makes a Leader?");
  });
});

describe("#3 their latest message shows above her reply (focused view)", async () => {
  const { StanceChat } = await import("@/components/stages/loop/stance-chat");
  const noop = () => undefined;
  const handlers = new Proxy({}, { get: () => noop });
  const sec = (over: Record<string, unknown> = {}) => ({ key: "intro", title: "Introduction", needs: "Introduce the work", mode: "lesson" as const, status: "open", concept: "Lead through change", teachAspect: null, chosenLead: null, logic: null, ...over });
  const render = (transcript: LoopLine[]) =>
    renderToStaticMarkup(
      createElement(StanceChat, {
        paperId: "00000000-0000-4000-8000-000000000000",
        intro: { heading: "Which style works best?", body: "This is the question your paper answers." },
        promptType: "lesson", sections: [sec(), sec({ key: "body", title: "Body" })], active: 0, kind: "probe", card: null, followUpCard: null,
        mirrorAsk: "", triggers: null, activeTrigger: null, safetyNote: "", batch: null, transcript, aside: { k: "intro", at: transcript.length, paras: [], intent: "content_question" },
        classify: async () => "content" as const, onAside: noop, idea: "", onIdea: noop, onPaste: noop, onDrop: noop, thinNote: null,
        noteStatus: "idle", skipped: [], voiceNote: null, handlers,
      } as never),
    );
  // A long paper: the saved transcript is capped at 80 lines (the old since-mount view came out empty).
  const filler: LoopLine[] = Array.from({ length: 77 }, (_, i): LoopLine => ({ k: "intro", who: i % 2 ? "you" : "pau", text: `older line ${i}` }));
  const latest: LoopLine[] = [
    { k: "intro", who: "you", text: "How did Sam Walton show servant leadership?" },
    { k: "intro", who: "pau", text: `${BACKGROUND_LABEL} Walton visited stores every week.` },
    { k: "intro", who: "pau", text: "Which of those do you want to build on in your paper?" },
  ];
  const t: LoopLine[] = [...filler, ...latest].slice(-80);
  it("shows the latest student message, then her reply, and no older turns", () => {
    const html = render(t);
    const you = html.indexOf("How did Sam Walton show servant leadership?");
    const reply = html.indexOf("Walton visited stores every week.");
    expect(you).toBeGreaterThan(-1);
    expect(reply).toBeGreaterThan(you);
    expect(html).not.toContain("older line 75");
  });
  it("the sent message shows at send time (before the reply comes back)", () => {
    const src = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    expect(src).toMatch(/setLookupNote\(mayNeedLookup\(text\)[^\n]*\n\s*setEcho\(text\)/);
    expect(src).toMatch(/pendingEcho \? <StudentBubble/);
  });
});
