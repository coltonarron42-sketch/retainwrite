/**
 * QA 10:38 follow-ups (Stages 1–3). Gates are unchanged (see stage23-gate-parity).
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OutlineChat } from "@/components/stages/loop/outline-chat";
import { quickLessonLine, StanceChat, stanceTurnParas, type StanceHandlers } from "@/components/stages/loop/stance-chat";
import { exampleLeadBatch } from "@/lib/coaching/exampleLeads";
import { finalizeLogicCheck, logicCheckFromNotes, notesOnPrompt } from "@/lib/coaching/logicCheck";
import { keptIdeas, probeForThinNote, THIN_NOTE } from "@/lib/coaching/thin";
import { applyOutlineDrafts } from "@/lib/papers/outline";
import { interestDisplay, practitionerReason } from "@/lib/stage1/leads";
import { ASIDE_FOLLOW_UP, finalStanceIntent, intentReply, needsModel, rulesStanceIntent } from "@/lib/stages/stance-intent";
import type { LoopLine } from "@/lib/stages/stance-turn";

const read = (p: string) => readFileSync(p, "utf8");
const loop = read("components/stages/loop/coaching-loop.tsx");
const noop = () => undefined;
const handlers = new Proxy({}, { get: () => noop }) as unknown as StanceHandlers;
const section = (over: Record<string, unknown> = {}) => ({
  key: "intro",
  title: "Introduction",
  needs: "Introduce the work",
  mode: "lesson" as const,
  status: "open",
  concept: "Should high schools start later in the morning?",
  teachAspect: null,
  chosenLead: null,
  logic: null,
  ...over,
});
function stance(over: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(StanceChat, {
      paperId: "00000000-0000-4000-8000-000000000000",
      intro: { heading: "Should high schools start later in the morning?", body: "This is the question your paper answers. We'll work through it one section at a time." },
      promptType: "lesson",
      sections: [section(), section({ key: "body", title: "Body", needs: "Develop the main examples" })],
      active: 0,
      kind: "probe",
      card: null,
      followUpCard: null,
      mirrorAsk: "",
      triggers: null,
      activeTrigger: null,
      safetyNote: "",
      batch: null,
      transcript: [],
      aside: null,
      classify: async () => "content",
      onAside: noop,
      idea: "",
      onIdea: noop,
      onPaste: noop,
      onDrop: noop,
      thinNote: null,
      noteStatus: "idle",
      skipped: [],
      voiceNote: null,
      handlers,
      ...over,
    } as Parameters<typeof StanceChat>[0]),
  );
}
const turns = (html: string) => (html.match(/data-pau-turn/g) ?? []).length;

describe("#1 Stage 2 opener is ONE reply", () => {
  it("question + 'one section at a time' + prompt type + chips + the first ask are one Pau Pau turn", () => {
    const html = stance();
    expect(turns(html)).toBe(1);
    expect(html).toContain("one section at a time");
    expect(html).toContain("Prompt type");
    expect(html).toMatch(/Do you already have an idea/);
  });
  it("after a reload with history, the opener is still inside the first reply", () => {
    const transcript: LoopLine[] = [
      { k: "intro", who: "pau", text: "Do you already have an idea of how you want this section to go?" },
      { k: "intro", who: "you", text: "Later start times help teens sleep and focus in first period." },
    ];
    const html = stance({ transcript, kind: "pick_lead" });
    expect(turns(html)).toBe(2);
    const first = html.slice(0, html.indexOf("You sent:"));
    expect(first).toContain("Prompt type");
    expect(first).toContain("Do you already have an idea");
  });
});

describe("#2 taps are 'Picked' chips, never student bubbles", () => {
  it("renders picks as chips and only typed words as student bubbles", () => {
    const transcript: LoopLine[] = [
      { k: "intro", who: "pau", text: "Pick one" },
      { k: "intro", who: "pick", text: "A moment where it shows up" },
      { k: "intro", who: "pau", text: "Logic check?" },
      { k: "intro", who: "pick", text: "Yes, check it" },
    ];
    const html = stance({ transcript, kind: "logic_opener" });
    expect((html.match(/data-picked-chip/g) ?? []).length).toBe(2);
    expect(html).not.toContain("You sent:");
  });
  it("every tap handler in the Stance chat records a pick, not a 'you' line", () => {
    const src = read("components/stages/loop/stance-chat.tsx");
    expect(src).not.toMatch(/you\((quality|SOMETHING_ELSE|KNOW_THIS_ONE|lead\.name|LOGIC_YES|LOGIC_TWEAK|LOGIC_CONTINUE|"Yes, lock it in"|"Continue"|"Keep my angle"|"Adjust it"|"Skip this section for now")/);
    expect(src).toContain("pick(LOGIC_CONTINUE)");
  });
});

describe("#3 requests and questions to Pau Pau are never saved as notes", () => {
  it("rules: requests, questions and content", () => {
    expect(rulesStanceIntent("Ask me some probing questions please.")).toBe("request_probe");
    expect(rulesStanceIntent("can you ask me questions")).toBe("request_probe");
    expect(rulesStanceIntent("what do you mean?")).toBe("question");
    expect(rulesStanceIntent("I don't get it")).toBe("question");
    expect(rulesStanceIntent("I'm stuck")).toBe("request_help");
    expect(rulesStanceIntent("Can you give me an example?")).toBe("request_help");
    expect(rulesStanceIntent("Later start times help teens sleep more and focus in first period.")).toBe("content");
    expect(rulesStanceIntent("Should schools start later?")).toBe("content");
    expect(rulesStanceIntent("I think teachers should ask students questions about sleep, because surveys show most teens get under seven hours a night and that hurts their grades in first period.")).toBe("content");
  });
  it("a model 'content' never overrides a clear request; otherwise the model decides", () => {
    expect(finalStanceIntent("content", "request_probe")).toBe("request_probe");
    expect(finalStanceIntent("question", "content")).toBe("question");
    expect(finalStanceIntent(null, "content")).toBe("content");
    expect(needsModel("Ask me some probing questions please.")).toBe(true);
  });
  it("a request is filtered out of the notes, the outline prefill and saved outline drafts", () => {
    expect(keptIdeas(["Ask me some probing questions please."])).toEqual([]);
    expect(keptIdeas(["Ask me some probing questions please.", "Teens sleep better with later start times."])).toEqual(["Teens sleep better with later start times."]);
    const s = applyOutlineDrafts([{ key: "intro", ideas: ["Teens sleep better with later start times."] }], [{ fieldKey: "outline:intro", text: "Ask me some probing questions please." }]);
    expect(s[0]!.ideas).toEqual(["Teens sleep better with later start times."]);
  });
  it("her reply gives coaching questions, never paper text, and never echoes the student", () => {
    const reply = intentReply("request_probe", { turn: "probe", section: { title: "Introduction" } }).join(" ");
    expect(reply).toMatch(/^Sure\. A few questions for your introduction/);
    expect((reply.match(/\?/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(intentReply("question", { turn: "probe", section: { title: "Body" } })[0]).toMatch(/^Good question\. I'm asking what you want your body to say/);
  });
  it("Stage 2 and Stage 3 check typed words before saving; the aside is not a note", () => {
    const stanceSrc = read("components/stages/loop/stance-chat.tsx");
    expect(stanceSrc).toMatch(/const intent = await props\.classify\(text, ask\);[\s\S]*if \(intent !== "content"\) \{[\s\S]*props\.onAside\(intent, turn, \[pau\(ask\), you\(text\)\]\);\s*return;/);
    const outlineSrc = read("components/stages/loop/outline-chat.tsx");
    expect(outlineSrc).toMatch(/if \(intent !== "content"\) \{[\s\S]*props\.onAside\(intent, current\.key[\s\S]*setText\(notes\);\s*return;/);
    const aside = loop.slice(loop.indexOf("function onAside"), loop.indexOf("function onTeachAspect"));
    expect(aside).not.toMatch(/ideas:|saveLoop|answers:/);
    expect(aside).toContain("clearSent(idea)");
  });
  it("the answer rides inside her current turn (one reply)", () => {
    const transcript: LoopLine[] = [{ k: "intro", who: "pau", text: "Do you already have an idea?" }, { k: "intro", who: "you", text: "Ask me some probing questions please." }];
    const html = stance({ transcript, aside: { k: "intro", at: 2, paras: ["Sure. A few questions for your introduction."] } });
    expect(turns(html)).toBe(2);
    const current = html.slice(html.lastIndexOf("data-pau-turn"));
    expect(current).toContain("Sure. A few questions for your introduction.");
    expect(current).toContain('id="stance-question"');
  });
  it("after probing questions she doesn't repeat the opening ask", () => {
    const transcript: LoopLine[] = [{ k: "intro", who: "pau", text: "Do you already have an idea?" }, { k: "intro", who: "you", text: "Ask me some probing questions please." }];
    const html = stance({ transcript, aside: { k: "intro", at: 2, paras: ["Sure. A few questions for your introduction."], intent: "request_probe" } });
    const current = html.slice(html.lastIndexOf("data-pau-turn"));
    expect(current).toContain(ASIDE_FOLLOW_UP);
    expect(current).not.toMatch(/or do you want me to ask some probing questions/);
    expect(current).toContain('id="stance-question"');
  });
});

describe("#4 the logic check checks relevance to the prompt first", () => {
  const prompt = "Should high schools start later in the morning?";
  const sheet = `Argumentative essay. ${prompt} Use at least three sources about teen sleep and school schedules.`;
  it("an off-topic claim is named as not answering the prompt (not a generalization critique)", () => {
    const raw = logicCheckFromNotes({ notes: "Pizza is the best food and everyone loves it more than anything else.", assignmentText: sheet, rubricRef: "intro", mode: "lesson", confirmedPrompt: prompt });
    expect(raw.reason).toBe(`This doesn't answer the question your prompt asks: “${prompt}”`);
    const fin = finalizeLogicCheck(raw, { assignmentText: sheet, studentNotes: "Pizza…", mode: "lesson", rubricRequiresCounterargument: false, validRubricRefs: ["intro", "ethics", "prompt"] });
    expect(fin.result.tier).not.toBe("pass");
    expect(fin.result.reason).toMatch(/^This doesn't answer the question your prompt asks/);
    const said = stanceTurnParas("logic_result", { section: section({ logic: { result: fin.result } }), card: null, mirrorAsk: "", activeTrigger: null });
    expect(said[0]).toBe(`Logic alert: This doesn't answer the question your prompt asks: “${prompt}”`);
  });
  it("on-topic notes are not flagged as off-prompt", () => {
    expect(notesOnPrompt("Starting school at 8:30 lets teens get more sleep before first period.", prompt, sheet)).toBe(true);
    expect(notesOnPrompt("Teens get more sleep and do better in class.", prompt, sheet)).toBe(true);
    const raw = logicCheckFromNotes({ notes: "Later start times help high school students sleep longer and focus in morning classes.", assignmentText: sheet, rubricRef: "intro", mode: "lesson", confirmedPrompt: prompt });
    expect(raw.tier).toBe("pass");
  });
});

describe("#5 Continue anyway is acknowledged and stays flagged in Stage 3", () => {
  it("her next turn acknowledges it and names the flag", () => {
    const body = loop.slice(loop.indexOf("async function continueAfterLogic"), loop.indexOf("function continueProductStage"));
    expect(body).toContain('choice === "continued" && target.kind === "section"');
    expect(body).toContain("I flagged your ${section.title.toLowerCase()} so you can come back to it before you draft.");
  });
  it("Stage 3 shows the flag on that section", () => {
    const html = renderToStaticMarkup(
      createElement(OutlineChat, {
        paperId: "00000000-0000-4000-8000-000000000000",
        persist: false,
        sections: [{ key: "intro", title: "Introduction", needs: "Introduce the work", ideas: ["Pizza is the best food."] }],
        done: [],
        transcript: [],
        aside: null,
        classify: async () => "content" as const,
        onAside: noop,
        flags: { intro: "This doesn't answer the question your prompt asks: “Should high schools start later in the morning?”" },
        saving: false,
        error: null,
        skipped: [],
        voiceNote: null,
        onSend: noop,
        onReopen: noop,
        onFinish: noop,
        onGoBack: noop,
      }),
    );
    expect(html).toContain("data-flag");
    expect(html).toContain("Flagged in Stance: This doesn&#x27;t answer");
    expect(loop).toContain("item.continued && item.logic && item.logic.result.tier !== \"pass\"");
  });
});

describe("#6 thin note: kind copy, scoped to its turn", () => {
  it("'Sleep matters' gets the clear 'too short' message", () => {
    expect(probeForThinNote("Sleep matters")).toBe(THIN_NOTE);
    expect(THIN_NOTE).toBe("That's a start. Give me a bit more: what's the one specific point this section should make?");
  });
  it("the hint is keyed to the turn, so it never carries into later bubbles", () => {
    expect(loop).toContain("const thinNote = thinState && thinState.turn === turnKey ? thinState.text : null;");
    const src = read("components/stages/loop/stance-chat.tsx");
    expect(src).toContain("const hint = hintState?.key === turnId ? hintState.text : null;");
    const html = stance({ thinNote: THIN_NOTE });
    expect((html.match(/data-thin-note/g) ?? []).length).toBe(1);
  });
});

describe("#7 lead titles are section-specific", () => {
  const base = { concept: "Should high schools start later in the morning?", assignmentText: "", rubricRef: "r" };
  it("different sections and notes give different directions", () => {
    const intro = exampleLeadBatch({ ...base, studentIdea: "I think later starts help teens sleep before first period.", section: { key: "intro", title: "Introduction" } });
    const body = exampleLeadBatch({ ...base, studentIdea: "Sleep debt shows up in grades and car crashes.", section: { key: "body", title: "Body" } });
    const a = intro.candidates.map((c) => c.name);
    const b = body.candidates.map((c) => c.name);
    expect(a.filter((n) => b.includes(n))).toEqual([]);
    expect(a[0]).toContain("introduction");
    expect(a[0]).toContain("later starts help teens sleep");
    expect(b[0]).toContain("Sleep debt shows up in grades");
    expect(stanceTurnParas("pick_lead", { section: section({ title: "Body" }), card: null, mirrorAsk: "", activeTrigger: null })[0]).toContain("for your body");
  });
  it("a long 'how did…' prompt is called 'your question', never spliced in mid-sentence", () => {
    const concl = exampleLeadBatch({ concept: "How did the New Deal change the relationship between Americans and the federal government?", assignmentText: "", rubricRef: "r", studentIdea: "People started expecting help from Washington in a crisis.", section: { key: "conclusion", title: "Conclusion" } });
    const names = concl.candidates.map((c) => c.name).join(" | ");
    expect(names).not.toMatch(/why how did|on how did/i);
    expect(names).toContain("your question still matters");
  });
});

describe("#8 title punctuation", () => {
  it("a question title keeps its own mark (no '?:' splice)", () => {
    const line = quickLessonLine("Should high schools start later in the morning?", "The question asks you to take a side.");
    expect(line).not.toMatch(/\?:/);
    expect(line).toBe("Quick lesson on your question, “Should high schools start later in the morning?” The question asks you to take a side.");
    expect(quickLessonLine("Later start times!", "x")).not.toMatch(/!:/);
    expect(quickLessonLine("sleep debt", "It builds up.")).toBe("Quick lesson on sleep debt: It builds up.");
  });
});

describe("#9 the last outline section always shows the Continue step", () => {
  it("sending the last section never finishes the stage by itself", () => {
    const send = loop.slice(loop.indexOf("async function onOutlineSend"), loop.indexOf("function onOutlineAside"));
    expect(send).not.toContain("finishOutline(");
    expect(loop).toContain("onFinish={() => void finishOutline(session)}");
  });
});

describe("#10 practitioner and interest copy", () => {
  it("names the topic and the interest; titles read 'something from Bluey'", () => {
    const a = ["I watch bluey with my sister and play soccer."];
    expect(interestDisplay("bluey", a)).toEqual({ name: "Bluey", phrase: "something from Bluey", media: true });
    expect(interestDisplay("soccer", a).media).toBe(false);
    expect(practitionerReason("Should high schools start later in the morning?", interestDisplay("bluey", a))).toBe(
      "A teacher, researcher or official who has dealt with “high schools start later” firsthand, in an interview or a case study. Bonus if it connects to something from Bluey.",
    );
    const src = read("components/stages/stage1/assignment-intake.tsx");
    expect(src).not.toContain("Someone who has written or spoken about the same question your prompt asks.");
    expect(src).toContain("Something from ${shown.name} that shows the same idea");
  });
});

describe("#11 barge-in", () => {
  const src = read("components/stages/stage1/chat-composer.tsx");
  it("Send while she talks stops her and takes the reply", () => {
    const send = src.slice(src.indexOf("  function send() {"), src.indexOf("  useEffect(() => {\n    sendRef.current"));
    expect(send).toContain("if (isSpeaking()) stopSpeech();");
    expect(send.indexOf("stopSpeech()")).toBeLessThan(send.indexOf("onSend()"));
  });
  it("echo protection stays: listening is paused while she talks unless the student taps 'Talk now'", () => {
    expect(src).toContain("callOn && !micMuted && !speaking && !sending");
    expect(src).toMatch(/callStatus === "paused" \? \([\s\S]*data-barge-in[\s\S]*stopSpeech\(\);/);
  });
});
