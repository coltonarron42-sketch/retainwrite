/**
 * QA 11:48 follow-ups: logic tiers, relevance first, append-only history,
 * typed text over chips, lead search terms. Gates are unchanged.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StanceChat, type StanceHandlers } from "@/components/stages/loop/stance-chat";
import { exampleLeadBatch, noteKeywords } from "@/lib/coaching/exampleLeads";
import { ANECDOTE_NUDGE, finalizeLogicCheck, logicCheckFromNotes, notesOnPrompt, selfContradicts } from "@/lib/coaching/logicCheck";
import { parseRelevance } from "@/lib/coaching/relevance";
import { exampleLeadWhy } from "@/lib/stage1/leads";
import { ASIDE_FOLLOW_UP, intentReply } from "@/lib/stages/stance-intent";
import type { LoopLine } from "@/lib/stages/stance-turn";

const read = (p: string) => readFileSync(p, "utf8");
const prompt = "Should high schools start later in the morning?";
const sheet = `ENG 101 Argumentative Essay. Prompt: ${prompt} Take a position on school start times and teen sleep. Use at least three credible sources. MLA 9.`;

function check(notes: string, over: { onPrompt?: boolean | null; mode?: "lesson" | "memory" } = {}) {
  const raw = logicCheckFromNotes({ notes, assignmentText: sheet, rubricRef: "lesson_concept", mode: over.mode ?? "lesson", confirmedPrompt: prompt, onPrompt: over.onPrompt });
  return finalizeLogicCheck(raw, { assignmentText: sheet, studentNotes: notes, mode: over.mode ?? "lesson", rubricRequiresCounterargument: false, validRubricRefs: ["lesson_concept", "ethics", "prompt"] }).result;
}

describe("#1 an on-topic personal anecdote is never severe", () => {
  const anecdotes = [
    "My sister is tired every school morning, so I think the bell should move later and let teens sleep.",
    "My brother falls asleep in first period, so later starts would help students like him.",
    "I noticed my friends are always tired at 7:30, which is why I think school should start at 8:30.",
    "When I had zero period last year my grades dropped, so early starts hurt learning.",
    "My mom says teens need more sleep, and I think a later bell would help them focus.",
    "In my school the buses come at 6:15, and everyone in my class is half asleep until lunch.",
  ];
  for (const claim of anecdotes) {
    it(`not severe: “${claim.slice(0, 50)}…”`, () => {
      const r = check(claim);
      expect(r.tier).not.toBe("strong");
      expect(r.reason).not.toMatch(/everyone needs more than a single pattern|One person's story cannot/);
    });
  }
  it("the anecdote gets the gentle nudge", () => {
    const r = check(anecdotes[0]!);
    expect(r.tier).toBe("moderate");
    expect(r.reason).toBe(ANECDOTE_NUDGE);
    expect(ANECDOTE_NUDGE).toBe("One example is a great start; what else shows this?");
  });
  it("an anecdote backed by research is fine as it is", () => {
    expect(check("My sister is tired every morning, and research on teen sleep shows later starts help.").tier).toBe("pass");
  });
  it("severe is kept for off-topic and self-contradictory claims", () => {
    expect(check("Honestly the best part of any school day is that the cafeteria pizza is the greatest food ever made and everyone should eat more pizza on weekends.").tier).toBe("strong");
    expect(selfContradicts("Schools should start later, but schools should not start later because buses cost money.")).toBe(true);
    expect(check("Schools should start later, but schools should not start later because buses cost money.").tier).toBe("strong");
    expect(selfContradicts("Schools should start later because teens should not lose sleep.")).toBe(false);
  });
});

describe("#2 relevance is checked first, on every section", () => {
  const pizza = "Honestly the best part of any school day is that the cafeteria pizza is the greatest food ever made and everyone should eat more pizza on weekends.";
  it("QA's pizza Body claim is named as off-prompt (an everyday word like 'school' doesn't count)", () => {
    expect(notesOnPrompt(pizza, prompt, sheet)).toBe(false);
    expect(check(pizza).reason).toBe(`This doesn't answer the question your prompt asks: “${prompt}”`);
  });
  it("relevance comes before the generalization nudge", () => {
    expect(check("Everyone loves pizza more than anything.").reason).toMatch(/^This doesn't answer/);
  });
  it("the model's verdict wins when it answered", () => {
    expect(check("Tired students do worse in first period, which shows in my own grades.", { onPrompt: true }).reason).not.toMatch(/^This doesn't answer/);
    expect(check("Later starts help teens sleep.", { onPrompt: false }).reason).toMatch(/^This doesn't answer/);
    expect(parseRelevance({ on_topic: false })).toBe(false);
    expect(parseRelevance({})).toBeNull();
  });
  it("not limited to lesson sections", () => {
    const raw = logicCheckFromNotes({ notes: pizza, assignmentText: sheet, rubricRef: "memory", mode: "memory", confirmedPrompt: prompt });
    expect(raw.reason).toMatch(/^This doesn't answer/);
  });
  it("the client asks the model at lock-in and uses it at 'Yes, check it'", () => {
    const loop = read("components/stages/loop/coaching-loop.tsx");
    expect(loop).toContain("/stance/relevance");
    expect(loop).toMatch(/async function onLogicOpener[\s\S]*const verdict = await pending;[\s\S]*checkNotes\(section, notes, verdict\)/);
  });
});

const noop = () => undefined;
const handlers = new Proxy({}, { get: () => noop }) as unknown as StanceHandlers;
const sec = (over: Record<string, unknown> = {}) => ({ key: "intro", title: "Introduction", needs: "Introduce the work", mode: "lesson" as const, status: "open", concept: prompt, teachAspect: null, chosenLead: null, logic: null, ...over });
function stance(over: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(StanceChat, {
      paperId: "00000000-0000-4000-8000-000000000000",
      intro: { heading: prompt, body: "This is the question your paper answers. We'll work through it one section at a time." },
      promptType: "lesson", sections: [sec(), sec({ key: "body", title: "Body" })], active: 0, kind: "probe", card: null, followUpCard: null,
      mirrorAsk: "", triggers: null, activeTrigger: null, safetyNote: "", batch: null, transcript: [], aside: null,
      classify: async () => "content" as const, onAside: noop, idea: "", onIdea: noop, onPaste: noop, onDrop: noop, thinNote: null,
      noteStatus: "idle", skipped: [], voiceNote: null, handlers, ...over,
    } as Parameters<typeof StanceChat>[0]),
  );
}

describe("#3 history is append-only; the opener never re-asks", () => {
  const opener = "Do you already have an idea of how you want this section to go, or do you want me to ask some probing questions so we can start finding research?";
  const probeReply = intentReply("request_probe", { turn: "probe", section: { title: "Introduction" } });
  const questionReply = intentReply("question", { turn: "probe", section: { title: "Introduction" } });
  const t1: LoopLine[] = [
    { k: "intro", who: "pau", text: opener },
    { k: "intro", who: "you", text: "Ask me some probing questions please." },
    ...probeReply.map((text): LoopLine => ({ k: "intro", who: "pau", text })),
  ];
  const t2: LoopLine[] = [
    ...t1,
    { k: "intro", who: "pau", text: ASIDE_FOLLOW_UP },
    { k: "intro", who: "you", text: "what do you mean?" },
    ...questionReply.map((text): LoopLine => ({ k: "intro", who: "pau", text })),
  ];
  it("her probing questions stay after the next turn (and after a reload: they're in the saved transcript)", () => {
    const html = stance({ transcript: t2, aside: { k: "intro", at: t2.length, paras: [], intent: "question" } });
    expect(html).toContain("Sure. A few questions for your introduction.");
    expect(html).toMatch(/I(&#x27;|')m asking what you want your introduction to say/);
    expect(html.split("or do you want me to ask some probing questions").length - 1).toBe(1);
    const current = html.slice(html.lastIndexOf("data-pau-turn"));
    expect(current).toMatch(/I(&#x27;|')m asking what you want your introduction to say/);
    expect(current).toMatch(/When you(&#x27;|')re ready, tell me your idea for your introduction in your own words\./);
    expect(current).not.toContain("or do you want me to ask");
  });
  it("onAside writes her answer into the transcript", () => {
    const loop = read("components/stages/loop/coaching-loop.tsx");
    expect(loop).toMatch(/function onAside[\s\S]*withLines\(\[\.\.\.more, \.\.\.paras\.map/);
    expect(loop).toMatch(/function onOutlineAside[\s\S]*appendLines\(session\.outlineTranscript, \[\.\.\.more, \.\.\.paras\.map/);
  });
});

describe("#4 typed text over chips is the student's reply, not a chip pick", () => {
  const src = read("components/stages/loop/stance-chat.tsx");
  it("teach card: typed words are saved as their note (no 'Picked: Something else')", () => {
    expect(src).toMatch(/case "teach_card":\s*\/\/[^\n]*\n\s*(await )?h\.probeSave\(\[pau\(card\?\.ask \?\? ask\), you\(text\)\], \{ fromTeach: true(, text)? \}\);/);
  });
  it("choice turns: typed words are discussion (Colton 11:45 PM); a replacement saves only after a swap yes", () => {
    expect(src).toMatch(/h\.discuss\(\[you\(text\), pau\(discussionLine\(/);
    expect(src).toMatch(/\{ replace: true, text: pending\.text \}/);
    expect(src).toMatch(/const intent = await props\.classify\(text, ask\);/);
  });
});

describe("#5 lead search terms, variety, punctuation", () => {
  const base = { concept: prompt, assignmentText: "", rubricRef: "r" };
  const idea = "My sister is tired every school morning, so I think the bell should move later and let teens sleep.";
  it("search terms are keywords, never the raw sentence", () => {
    expect(noteKeywords(idea, "high schools start later")).toEqual(["tired", "morning", "bell"]);
    const b = exampleLeadBatch({ ...base, studentIdea: idea, section: { key: "intro", title: "Introduction" } });
    const why = b.candidates[0]!.whyFits;
    expect(why).not.toMatch(/My sister|so I think/i);
    // 2-6 clean words (QA 2:08 #7c).
    expect(why).toContain("“high schools start later tired morning”");
  });
  it("the third direction differs by section", () => {
    const third = (key: string, title: string) => exampleLeadBatch({ ...base, studentIdea: idea, section: { key, title } }).candidates[2]!.name;
    const all = [third("intro", "Introduction"), third("body", "Body"), third("conclusion", "Conclusion")];
    expect(new Set(all.map((n) => n.split(" ").slice(0, 3).join(" "))).size).toBe(3);
  });
  it("a quoted question keeps its '?'", () => {
    expect(exampleLeadWhy("soccer", "Should schools start later?")).toContain("“Should schools start later?”");
  });
  it("the Quick lesson is Body-only by design (the concept is taught where it's applied)", () => {
    const loop = read("components/stages/loop/coaching-loop.tsx");
    expect(loop).toMatch(/key: "intro"[^\n]*concept: null/);
    expect(loop).toMatch(/key: "conclusion"[^\n]*concept: null/);
    expect(read("PLAN.md")).toMatch(/Quick lesson[^\n]*Body/);
  });
});

describe("#7 'Talk now' never wraps", () => {
  it("whitespace-nowrap on the barge-in button", () => {
    expect(read("components/stages/stage1/chat-composer.tsx")).toMatch(/data-barge-in[\s\S]{0,200}whitespace-nowrap/);
  });
});
