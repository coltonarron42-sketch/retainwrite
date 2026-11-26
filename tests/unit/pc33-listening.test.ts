import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { moderateConcern, STOCK_POOLS } from "@/components/stages/loop/stance-chat";
import { LESSON_PROBE_OPENER, MEMORY_PROBE_OPENER } from "@/lib/coaching/memoryPath";
import { finalizeLogicCheck, logicCheckFromNotes, notesOnPrompt } from "@/lib/coaching/logicCheck";
import {
  asCounterpoint,
  exploreNote,
  exploreReply,
  exploreTopic,
  isClosingPhrase,
  isExploreDone,
  isExploreIntent,
  isExploreLock,
  isGenericPressureReason,
  keepAngleSummary,
  officialListenNote,
  listenConfirmOffer,
  listeningClaim,
  oneOptionLeadBatch,
  parseListenModelClaim,
  parseListenModelReply,
  pressureTestLine,
  specificPressureTest,
  stripLeadIns,
  applyOnTopicPressureTest,
  sectionClaimSummary,
  fallbackParaphrase,
} from "@/lib/stages/explore-intent";
import { isUnquotableLeadIdea, visibleSourceLead, exampleLeadBatch } from "@/lib/coaching/exampleLeads";
import { assembleLeadBatch } from "@/lib/coaching/leadBatch";
import { afterMirror, afterProbe, officialLeadName, outlineSectionsForContinue, stanceTurnFor, substantiveNote } from "@/lib/stages/stance-turn";
import { isConfirmOnly, looksLikeNewPoint, stripReplyFillers } from "@/lib/stages/confirm-only";
import { keptIdeas } from "@/lib/coaching/thin";
import { replaceClaim } from "@/lib/coaching/logicRevision";

const QA = {
  counter: "can I talk through the counterargument idea a bit before I commit?",
  hearMeOut: "I'm not ready to lock that in… hear me out",
  costco: "Can I talk through the Costco comparison… haven't decided if it belongs",
  done: "yeah that's what I want for now",
  lock: "ok lock it",
};

describe("PC-33: explore intent", () => {
  it("detects the QA utterances and close cousins, not ordinary notes", () => {
    expect(isExploreIntent(QA.counter)).toBe(true);
    expect(isExploreIntent(QA.hearMeOut)).toBe(true);
    expect(isExploreIntent(QA.costco)).toBe(true);
    expect(isExploreIntent("let me think out loud about a second example")).toBe(true);
    expect(isExploreIntent("I haven't decided if a rebuttal belongs here")).toBe(true);
    expect(isExploreIntent("Sam Walton put associates first, and that is servant leadership.")).toBe(false);
    expect(isExploreIntent("not sure what to write")).toBe(false);
    expect(isExploreIntent("")).toBe(false);
  });

  it("done and lock cues match Colton's signals, and a bare ok only counts when invited", () => {
    expect(isExploreDone(QA.done)).toBe(true);
    expect(isExploreDone("that's it for now")).toBe(true);
    expect(isExploreDone(QA.lock)).toBe(true);
    expect(isExploreLock(QA.lock)).toBe(true);
    expect(isExploreLock(QA.done)).toBe(false);
    expect(isExploreDone("ok")).toBe(false);
    expect(isExploreDone("ok", "I'm here if you want to keep going, or tell me when that's what you want for now.")).toBe(true);
    expect(isExploreDone("yes", "What's your idea for this section?")).toBe(false);
    expect(isExploreDone(QA.hearMeOut)).toBe(false);
    expect(isExploreLock(QA.hearMeOut)).toBe(false);
    expect(isExploreDone("I'm not ready to lock that in")).toBe(false);
    expect(isExploreLock("I'm not ready to lock that in")).toBe(false);
  });

  it("pulls a clean noun-phrase topic and only notes real substance, never a bare request", () => {
    expect(exploreTopic(QA.counter)).toBe("the counterargument idea");
    expect(exploreTopic(QA.costco)).toBe("the Costco comparison");
    expect(exploreTopic(QA.hearMeOut)).toBeNull();
    expect(exploreNote(QA.counter)).toBeNull();
    expect(exploreNote(QA.hearMeOut)).toBeNull();
    expect(exploreNote("Can I talk through the Costco comparison — they treat workers well, but I'm not sure it belongs")).toMatch(/treat workers well/i);
  });

  it("the listen reply acknowledges, reflects, keeps the floor open, and does not interview", () => {
    const reply = exploreReply(QA.costco, "Body");
    expect(reply).toMatch(/talk through the Costco comparison/i);
    expect(reply).toMatch(/body/i);
    expect(reply).toMatch(/still deciding whether the Costco comparison belongs/i);
    expect(reply).not.toMatch(/I'll note it/i);
    expect(reply).not.toMatch(/Going with it|lock it in|Your call is below|Pick one to chase/i);
    expect(reply).not.toMatch(/talk through (?!(?:the|a|an) )/i);
    // At most one question, and only when there is nothing to reflect.
    expect((exploreReply("Can I talk through the Costco comparison — they treat workers well, but I haven't decided if it belongs", "Body").match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
    const bare = exploreReply("hear me out", "Introduction");
    expect((bare.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(bare).toMatch(/let's talk it through before anything gets locked/i);
    expect(bare).not.toMatch(/talk through this/i);
  });
});

describe("PC-33: listening acknowledgements stay grammatical", () => {
  const cues: Array<[string, string | null]> = [
    ["can I talk through the counterargument idea a bit before I commit?", "the counterargument idea"],
    ["Can I talk through the Costco comparison… haven't decided if it belongs", "the Costco comparison"],
    ["I'm not ready to lock that in… hear me out", null],
    ["hear me out", null],
    ["Let's talk this through before I lock it", null],
    ["can I talk through it a bit before I commit?", null],
    ["I want to talk through my Walton angle before I commit", "the Walton angle"],
    ["talk through an opposing view first", "an opposing view"],
    ["let me think out loud about a second example", "a second example"],
    ["I want to bounce the profit-sharing example off you", "the profit-sharing example"],
    ["I haven't decided if a Costco comparison belongs", "a Costco comparison"],
  ];

  function assertGrammatical(reply: string) {
    expect(reply).not.toMatch(/talk through I(?:'m| am|'d|'ve|'ll)?\b/i);
    expect(reply).not.toMatch(/talk through (?:not|ready|lock|it|this|that|my)\b/i);
    expect(reply).not.toMatch(/talk through (?!(?:the|a|an) )[A-Za-z]/i);
    expect(reply).not.toMatch(/talk through (?:counterargument idea|Costco comparison)(?!\w)/);
  }

  it("extracts an article + noun phrase, or falls back, for about ten cue phrasings", () => {
    expect(cues).toHaveLength(11);
    for (const [cue, topic] of cues) {
      expect(exploreTopic(cue), cue).toBe(topic);
      const reply = exploreReply(cue, "Introduction");
      assertGrammatical(reply);
      if (topic) {
        expect(reply, cue).toContain(`talk through ${topic}`);
        expect(reply, cue).toMatch(/before anything gets locked in your introduction/i);
      } else {
        expect(reply, cue).toMatch(/Got it, let's talk it through before anything gets locked\./);
        expect(reply, cue).not.toMatch(/you want to talk through /i);
      }
      expect(reply, cue).not.toMatch(/Going with it|lock it in|Your call is below|Pick one to chase/i);
    }
  });
});

describe("PC-33: listening and keep-confirm turn mapping", () => {
  const base = { mode: "lesson" as const, loopStep: "summarize", status: "open", hasLogic: false, logicRevealed: false };
  const opts = { hasCard: false, personalized: true, hasBatch: true };

  it("listening wins over confirm, search, and logic, and clears back to the underlying turn", () => {
    expect(stanceTurnFor({ ...base, listening: true }, opts)).toBe("listening");
    expect(stanceTurnFor({ ...base, loopStep: "search", listening: true }, opts)).toBe("listening");
    expect(stanceTurnFor({ ...base, loopStep: "logic_check", hasLogic: true, listening: true }, opts)).toBe("listening");
    expect(stanceTurnFor(base, opts)).toBe("confirm");
  });

  it("pending Keep my angle is its own confirm turn, not an instant advance", () => {
    expect(stanceTurnFor({ ...base, loopStep: "logic_check", hasLogic: true, logicRevealed: true, pendingKeep: true }, opts)).toBe("keep_confirm");
  });
});

describe("PC-33: one option set per turn", () => {
  it("hides the stretch when directions are already on screen, and caps the list", () => {
    const batch = oneOptionLeadBatch({
      ranked: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }],
      wildcard: { name: "Stretch" },
    });
    expect(batch.ranked).toHaveLength(3);
    expect(batch.wildcard).toBeNull();
  });

  it("the Stage 2 UI uses the one-option helper and does not render a stretch next to directions", () => {
    const src = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    expect(src).toContain("oneOptionLeadBatch");
    expect(src).toContain("visibleBatch");
    expect(src).toContain("visibleBatch.wildcard");
    expect(src).toMatch(/visibleBatch\.wildcard \?/);
    expect(src).not.toMatch(/kind === "pick_lead" && props\.batch \?[\s\S]{0,400}props\.batch\.wildcard \?/);
  });

  it("section openers are one question with no stacked probing offer", () => {
    expect(LESSON_PROBE_OPENER).toBe("What's your idea for this section?");
    expect(MEMORY_PROBE_OPENER).toBe("What moment do you have in mind for this section?");
    expect(LESSON_PROBE_OPENER).not.toMatch(/probing questions/i);
    for (const line of [...STOCK_POOLS.lesson_probe, ...STOCK_POOLS.memory_probe]) {
      expect((line.match(/\?/g) ?? []).length, line).toBeLessThanOrEqual(1);
      expect(line, line).not.toMatch(/probing questions|I can ask a few questions|grill you|questions first|I'll ask a few/i);
    }
  });
});

describe("PC-33: Keep my angle confirms first", () => {
  it("summarizes the student's angle and asks for a tap before advancing", () => {
    const line = keepAngleSummary("Sam Walton put associates first instead of selling a big vision.", "Introduction");
    expect(line).toMatch(/Sam Walton put associates first/i);
    expect(line).toMatch(/introduction/i);
    expect(line).toMatch(/Tap below/i);
    expect(line).not.toMatch(/Back to your body/i);
  });

  it("the first Keep my angle tap does not advance; the confirm tap does", () => {
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    const chat = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    expect(loop).toContain("pendingKeep");
    expect(chat).toContain("keepAngleSummary");
    expect(chat).toContain("Yes, keep this and move on");
    // Advance still happens, but only after the pending confirm.
    expect(loop).toContain('continueAfterLogic("keep", more)');
    expect(loop).toMatch(/if \(choice === "keep"\)[\s\S]*if \(!live\.pendingKeep\)/);
  });
});

describe("PC-33: pressure-test names the claim and a counterpoint", () => {
  it("never returns the generic line alone", () => {
    expect(isGenericPressureReason("A reasonable reader could see this another way.")).toBe(true);
    const line = pressureTestLine({
      claim: "Walton was a servant leader because he put associates first.",
      reason: "A reasonable reader could see this another way.",
      counterpoint: "his cost-cutting also kept wages low",
    });
    expect(line).toMatch(/Walton was a servant leader/i);
    expect(line).toMatch(/wages low/i);
    expect(line).not.toMatch(/^A reasonable reader could see this another way\.?$/);
    expect(pressureTestLine({ claim: "Later start times help teens sleep." })).toMatch(/Later start times help teens sleep/);
    expect(asCounterpoint("What would someone who disagrees say about the wage tradeoff?")).toMatch(/wage tradeoff/i);
  });

  it("the heuristic moderate reason and on-screen concern use the claim-specific line", () => {
    const raw = logicCheckFromNotes({
      notes: "Maybe transformational leadership could be read either way for Walton.",
      assignmentText: "Argue which leadership style is most effective.",
      rubricRef: "lesson_concept",
      mode: "lesson",
      confirmedPrompt: "Which leadership style is most effective for leading a team through change?",
    });
    expect(raw.tier).toBe("moderate");
    expect(raw.reason).toMatch(/Walton|transformational/i);
    expect(raw.reason).not.toMatch(/^A reasonable reader could see this another way\.?$/);
    const shown = moderateConcern(
      { reason: "A reasonable reader could see this another way.", alternativeAngles: [{ question: "What about the wage tradeoff at Walmart?" }] },
      "Walton was a servant leader because he put associates first.",
      "Introduction",
    );
    expect(shown).toMatch(/Walton was a servant leader/i);
    expect(shown).toMatch(/wage tradeoff/i);
  });
});

describe("PC-33: wiring stays out of Stage 1 and the gate", () => {
  it("the loop and chat handle explore intent before a lock or a lead menu", () => {
    const chat = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    expect(chat).toContain("isExploreIntent");
    expect(chat).toContain('kind === "listening"');
    expect(chat).not.toMatch(/Going with it\?[\s\S]{0,200}isExploreIntent/);
    expect(loop).toContain("onListen");
    expect(loop).toContain("listening:");
  });
});

describe("PC-33: explore cues beat the wandering lead path", () => {
  const sheet = "Prompt: Which leadership style is most effective? Write an argument essay.";

  it("the wander-plus-explore QA line is listen-first, never an official note", () => {
    expect(isExploreIntent(QA.counter)).toBe(true);
    expect(keptIdeas([QA.counter])).toEqual([]);
    expect(keptIdeas(["Sam Walton put associates first.", QA.counter])).toEqual(["Sam Walton put associates first."]);
    const chat = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    const listenAt = chat.search(/if \(kind === "listening" \|\| isExploreIntent\(text\)\)/);
    const classifyAt = chat.indexOf("props.classify(text, ask)");
    expect(listenAt).toBeGreaterThan(0);
    expect(classifyAt).toBeGreaterThan(listenAt);
  });

  it("direction cards never echo the student's own question, including the QA explore line", () => {
    const cues = [QA.counter, QA.hearMeOut, QA.costco, "Is a later bell fair to parents?"];
    for (const idea of cues) {
      const b = exampleLeadBatch({
        concept: "servant leadership",
        assignmentText: sheet,
        studentIdea: idea,
        rubricRef: "prompt",
        section: { key: "intro", title: "Introduction" },
      });
      const cards = [...b.candidates, b.wildcard].filter(Boolean);
      expect(cards.length).toBeGreaterThan(0);
      for (const c of cards) {
        expect(c!.name, idea).not.toContain("You wrote");
        expect(c!.name, idea).not.toContain(idea.replace(/[?…]+$/u, "").trim());
        expect(c!.whyFits, idea).not.toContain(idea.replace(/[?…]+$/u, "").trim());
      }
    }
    const claim = exampleLeadBatch({
      concept: "servant leadership",
      assignmentText: sheet,
      studentIdea: "Sam Walton put associates first.",
      rubricRef: "prompt",
      section: { key: "intro", title: "Introduction" },
    });
    expect(claim.candidates[0]!.name).toMatch(/^You wrote “Sam Walton put associates first\.?”/);
  });
});

describe("PC-33: confirm phrases never become notes or claims", () => {
  const hint = "Hmm, can I talk through the counterargument idea? I'm not sure yet if the intro should hint that transformational leaders get more credit.";
  const press = "hear me out: maybe servant leaders just get less press";

  it("treats confirm and closing phrases as closing, never as notes", () => {
    expect(isClosingPhrase(QA.done)).toBe(true);
    expect(isClosingPhrase("that's it for now")).toBe(true);
    expect(isClosingPhrase("ok lock it")).toBe(true);
    expect(isClosingPhrase(QA.hearMeOut)).toBe(false);
    expect(isClosingPhrase(press)).toBe(false);
    expect(exploreNote(QA.done)).toBeNull();
    expect(exploreNote("yeah that's what I want for now")).toBeNull();
    expect(keptIdeas([QA.done, "ok lock it in"])).toEqual([]);
  });

  it("synthesizes the locked claim from listening turns, ignoring the confirm phrase", () => {
    const claim = listeningClaim([hint, press, QA.done], "Introduction");
    expect(claim).toBeTruthy();
    expect(claim!).toMatch(/transformational leaders get more(?: of the)? credit/i);
    expect(claim!).toMatch(/servant leaders.*less press/i);
    expect(claim!).not.toMatch(/yeah that's what I want for now/i);
    expect(isClosingPhrase(claim!)).toBe(false);
    expect(listeningClaim([QA.done], "Introduction")).toBeNull();
    const recap = keepAngleSummary(officialListenNote([claim!], QA.done), "Introduction");
    expect(recap).toMatch(/transformational leaders get more(?: of the)? credit/i);
    expect(recap).not.toMatch(/yeah that's what I want for now/i);
    expect(keepAngleSummary(QA.done, "Introduction")).not.toMatch(/yeah that's what I want for now/i);
    expect(pressureTestLine({ claim: QA.done, reason: "This doesn't answer the question your prompt asks." })).not.toMatch(/yeah that's what I want for now/i);
  });
});

describe("PC-33: acknowledgements paraphrase, they never quote raw fragments", () => {
  const hint = "Hmm, can I talk through the counterargument idea? I'm not sure yet if the intro should hint that.";
  const press = "hear me out: maybe servant leaders just get less press";

  it("does not quote or truncate the student's raw text", () => {
    for (const cue of [hint, press, QA.costco, "Can I talk through the Costco comparison a bit? I haven't decided if it belongs"]) {
      const reply = exploreReply(cue, "Introduction");
      expect(reply, cue).not.toMatch(/I'?m hearing\s*[“"']/i);
      expect(reply, cue).not.toContain("Costco comparison a bit? I.");
      expect(reply, cue).not.toMatch(/talk through I(?:'m| am)?\b/i);
      expect(reply, cue).not.toMatch(/[“"]Hmm, can I talk through/i);
      const last = reply.trim().slice(-1);
      expect([".", "?", "!"].includes(last), reply).toBe(true);
    }
  });

  it("engages a specific point instead of the generic hold question", () => {
    const reply = exploreReply(press, "Introduction");
    expect(reply).toMatch(/less press/i);
    expect(reply).not.toMatch(/what'?s the one piece of this you want me to hold onto/i);
    expect((reply.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
    const hintReply = exploreReply(hint, "Introduction");
    expect(hintReply).toMatch(/hint/i);
    expect(hintReply).not.toMatch(/I'?m hearing/i);
    expect(hintReply).not.toMatch(/what'?s the one piece of this you want me to hold onto/i);
  });

  it("rejects a model reply that quotes or truncates, and accepts a clean paraphrase", () => {
    const fallback = exploreReply(press, "Introduction");
    expect(parseListenModelReply('{"reply":"I\'m hearing “Costco comparison a bit? I.”"}', fallback)).toBe(fallback);
    expect(parseListenModelReply("You're considering that servant leaders just get less press. Want to unpack why?", fallback)).toMatch(/servant leaders just get less press/i);
  });
});

describe("PC-33: lead cards and confirm chrome stay real", () => {
  it("does not quote a student fragment like 'Ooh, honestly both!' on a lead card", () => {
    expect(isUnquotableLeadIdea("Ooh, honestly both!")).toBe(true);
    const b = exampleLeadBatch({
      concept: "servant leadership",
      assignmentText: "Prompt: Which leadership style is most effective?",
      studentIdea: "Ooh, honestly both!",
      rubricRef: "prompt",
      section: { key: "body", title: "Body" },
    });
    for (const c of [...b.candidates, b.wildcard].filter(Boolean)) {
      expect(c!.name).not.toContain("Ooh, honestly both");
      expect(c!.name).not.toContain("You wrote");
    }
  });

  it("the confirm turn never renders a 'Lead: your lead' placeholder", () => {
    const src = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    expect(src).not.toMatch(/chosenLead \?\? ["']your lead["']/);
    expect(src).toMatch(/your lead\|your angle/);
    expect(readFileSync("components/stages/loop/coaching-loop.tsx", "utf8")).toContain("listeningClaim");
    expect(src).toContain("fetchListenReply");
  });
});

describe("PC-33: default Intro and Body direction flow is one option set", () => {
  it("never shows direction cards plus a stretch on Intro or Body, even outside listening", () => {
    const sheet = "Prompt: Which leadership style is most effective? Write an argument essay.";
    for (const section of [
      { key: "intro", title: "Introduction" },
      { key: "body", title: "Body" },
    ]) {
      const examples = exampleLeadBatch({
        concept: "servant leadership",
        assignmentText: sheet,
        studentIdea: "Sam Walton put associates first.",
        rubricRef: "prompt",
        section,
      });
      expect(examples.candidates.length).toBeGreaterThan(0);
      const assembled = assembleLeadBatch({
        candidates: examples.candidates,
        wildcard: examples.wildcard,
        aiSuggestedSoFar: 0,
        under18: false,
      });
      const visible = oneOptionLeadBatch(assembled);
      expect(visible.ranked.length, section.title).toBeGreaterThan(0);
      expect(visible.ranked.length, section.title).toBeLessThanOrEqual(3);
      expect(visible.wildcard, section.title).toBeNull();
    }
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    const chat = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    expect(loop).toContain("oneOptionLeadBatch");
    expect(chat).toContain("visibleBatch");
    expect(chat).toMatch(/visibleBatch\.wildcard \?/);
    expect(chat).not.toMatch(/props\.batch\.wildcard/);
  });
});

describe("PC-33: clean claim, paraphrase, confirm, and specific pressure test", () => {
  const hint =
    "Hmm, can I talk through the counterargument idea? I'm not sure yet if the intro should hint that transformational leaders get more credit.";
  const press = "hear me out: maybe servant leaders just get less press";
  const done = "yeah that's what I want for now";

  it("strips colons and lead-ins like maybe, hear me out, and I think", () => {
    expect(stripLeadIns("hear me out: maybe servant leaders just get less press")).toBe(
      "servant leaders just get less press",
    );
    expect(stripLeadIns(": maybe servant leaders just get less press")).toBe("servant leaders just get less press");
    expect(stripLeadIns("I think the intro should hint that they get more credit")).toBe(
      "the intro should hint that they get more credit",
    );
    expect(exploreNote(press)).toBe("Servant leaders just get less press");
  });

  it("synthesizes one clean Pau sentence from the exact QA listening turns", () => {
    const claim = listeningClaim([hint, press, done], "Introduction");
    expect(claim).toBe(
      "Your intro hints that transformational leaders get more of the credit, while servant leaders get less press.",
    );
    expect(claim!).not.toMatch(/;:|;\s*:|maybe|hear me out|I think|that's a start/i);
    expect((claim!.match(/[.!?]/g) ?? []).filter((ch) => ch !== ",").length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to that clean sentence when the model returns a raw join or leftover maybe", () => {
    const fallback = listeningClaim([hint, press, done], "Introduction");
    expect(
      parseListenModelClaim(
        "The introduction could hint that transformational leaders get more credit;: maybe servant leaders just get less press.",
        fallback,
      ),
    ).toBe(fallback);
    expect(parseListenModelClaim('{"claim":"maybe servant leaders just get less press"}', fallback)).toBe(fallback);
  });

  it("paraphrases the less-press turn instead of sitting with a verbatim colon join", () => {
    const reply = exploreReply(press, "Introduction");
    expect(reply).toMatch(/so your hunch is that servant leaders just don't get as much press/i);
    expect(reply).not.toMatch(/sitting with the idea that/i);
    expect(reply).not.toMatch(/that:\s*maybe/i);
    expect(reply).not.toMatch(/hear me out/i);
    expect(reply).not.toMatch(/maybe servant leaders just get less press/i);
    expect((reply.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
    const messy = "You're sitting with the idea that: maybe servant leaders just get less press. Want to unpack why they get less press, or keep going?";
    expect(parseListenModelReply(messy, reply)).toBe(reply);
  });

  it("treats the confirm phrase as the confirm: one summary, then a specific pressure-test offer", () => {
    const claim = listeningClaim([hint, press, done], "Introduction")!;
    const offer = listenConfirmOffer(claim, "Introduction");
    expect(offer).toMatch(/^Your intro hints that transformational leaders get more of the credit, while servant leaders get less press\./);
    expect(offer).toMatch(/A reader might counter that servant leaders getting less press may just be a feeling, not something you can show\./);
    expect(offer).toMatch(/Do you have an example, like Walton, where the press credited something else\?/);
    expect(offer).not.toMatch(/that's a start/i);
    expect(offer).not.toMatch(/want to go with it/i);
    expect(offer).not.toMatch(/same evidence also supports the opposite reading/i);
    expect((offer.match(/\?/g) ?? []).length).toBe(1);
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    const onListen = loop.slice(loop.indexOf("async function onListen"), loop.indexOf("function onTeachSkip"));
    expect(onListen).toContain("patch.logicRevealed = true");
    expect(onListen).toMatch(/applyOnTopicPressureTest|specificPressureTest/);
    expect(onListen).not.toContain('loopStep = "summarize"');
    expect(onListen).not.toContain("that's a start");
  });

  it("makes the pressure test specific to the less-press claim, in one line and one question", () => {
    const claim =
      "Your intro hints that transformational leaders get more of the credit, while servant leaders get less press.";
    const line = specificPressureTest(claim);
    expect(line).toBe(
      "A reader might counter that servant leaders getting less press may just be a feeling, not something you can show. Do you have an example, like Walton, where the press credited something else?",
    );
    expect((line.match(/\?/g) ?? []).length).toBe(1);
    const generic = pressureTestLine({
      claim,
      reason: "A reasonable reader could see this another way.",
      counterpoint: "the same evidence also supports the opposite reading",
    });
    expect(generic).toBe(line);
    expect(generic).not.toMatch(/same evidence also supports the opposite reading/i);
    const client = readFileSync("lib/stages/listen-client.ts", "utf8");
    const route = readFileSync("app/api/papers/[paperId]/stance/listen/route.ts", "utf8");
    expect(client).toMatch(/LISTEN_CLIENT_MS = 11_000/);
    expect(route).toMatch(/LISTEN_MODEL_TIMEOUT_MS = 8_000/);
  });
});

describe("PC-33: QA should-fixes for cards, first-turn listen, and pressure test", () => {
  const sheet =
    "BUS 210 Leadership essay for Prof. Kim. Using Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice) and the assigned HBR article 'What Makes a Leader?' by Daniel Goleman, write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7. Due Dec 10.";
  const prompt = "which leadership style is most effective for leading a team through change, using one real leader as your example";

  it("never splices a mid-phrase cut of the raw prompt into a conclusion card", () => {
    const b = exampleLeadBatch({
      concept: prompt,
      assignmentText: sheet,
      studentIdea: "",
      rubricRef: "prompt",
      section: { key: "conclusion", title: "Conclusion" },
    });
    const blob = JSON.stringify(b);
    expect(blob).not.toMatch(/through…/);
    expect(blob).not.toMatch(/leading a team through…/);
    expect(blob).not.toMatch(/Something this assignment would recognize as about which leadership style is most effective for leading a team through…/);
    const third = b.candidates[2]!.whyFits;
    expect(third).toMatch(/about your question|leadership style leading team change/i);
    expect(third).not.toMatch(/…/);
    expect(third).not.toMatch(/which leadership style is most effective for leading a team through/i);
  });

  it("reflects the Costco belong-point on the first Body listening turn, not a generic hold", () => {
    const reply = exploreReply(QA.costco, "Body");
    expect(reply).toMatch(/talk through the Costco comparison/i);
    expect(reply).toMatch(/still deciding whether the Costco comparison belongs/i);
    expect(reply).not.toMatch(/I'll note it/i);
    expect((reply.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("the pressure test is one counterpoint statement plus a single question", () => {
    const claim =
      "Your intro hints that transformational leaders get more of the credit, while servant leaders get less press.";
    const line = specificPressureTest(claim);
    expect(line).toMatch(/^A reader might counter that /);
    expect(line).not.toMatch(/A reader might ask whether/);
    expect((line.match(/\?/g) ?? []).length).toBe(1);
    expect(listenConfirmOffer(claim, "Introduction").match(/\?/g)?.length).toBe(1);
  });
});


describe("isConfirmOnly covers every lock and claim write path", () => {
  const PHRASE = "Yes, that is my plan for the body.";

  it("treats the exact QA confirm-plus-filler as confirm-only", () => {
    expect(isConfirmOnly(PHRASE)).toBe(true);
    expect(isConfirmOnly("yep that's it")).toBe(true);
    expect(isConfirmOnly("sounds right")).toBe(true);
    expect(isConfirmOnly("Yes, that is my plan for the introduction.")).toBe(true);
    expect(isConfirmOnly("Yes, that is my plan for the conclusion.")).toBe(true);
    expect(isConfirmOnly("that is my plan for the body")).toBe(true);
    expect(isConfirmOnly("Yes, Walton visiting stores is my body example.")).toBe(false);
    expect(isConfirmOnly("My plan for the body is that Walton put associates first.")).toBe(false);
  });

  it("never stores the confirm phrase as a lead, idea, or lock-card line", () => {
    expect(keptIdeas(["Walton visits stores often.", PHRASE])).toEqual(["Walton visits stores often."]);
    expect(visibleSourceLead(PHRASE)).toBeNull();
    expect(officialLeadName(PHRASE)).toBeNull();
    expect(officialLeadName("Walton visiting stores")).toBe("Walton visiting stores");
    expect(substantiveNote(PHRASE)).toBe(false);
    const probed = afterProbe({ ideas: ["Walton visits stores often."], searchStatus: "not_needed" }, PHRASE, false);
    expect(probed.ideas).toEqual(["Walton visits stores often."]);
    expect(probed.ideas.join(" ")).not.toMatch(/Yes, that is my plan for the body/i);
    const mirrored = afterMirror({ ideas: ["Servant leaders earn trust."] }, "Yes, that is my plan for the introduction.");
    expect(mirrored.ideas).toEqual(["Servant leaders earn trust."]);
    expect(replaceClaim(["Walton visits stores often."], PHRASE)).toEqual(["Walton visits stores often."]);
    expect(listeningClaim([PHRASE], "Body")).toBeNull();
    expect(officialListenNote([PHRASE], PHRASE)).toBe("");
    const continued = outlineSectionsForContinue(
      [{ key: "body", ideas: ["Walton visits stores often."] }],
      { body: PHRASE },
    );
    expect(continued[0]!.ideas).toEqual(["Walton visits stores often."]);
    const conclusion = outlineSectionsForContinue(
      [{ key: "conclusion", ideas: ["The team still needs a servant lead."] }],
      { conclusion: "Yes, that is my plan for the conclusion." },
    );
    expect(conclusion[0]!.ideas).toEqual(["The team still needs a servant lead."]);
  });

  it("the default lock, Body, Intro, and Conclusion write paths all call the guard", () => {
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    const chat = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    const turn = readFileSync("lib/stages/stance-turn.ts", "utf8");
    const thin = readFileSync("lib/coaching/thin.ts", "utf8");
    const leads = readFileSync("lib/coaching/exampleLeads.ts", "utf8");
    const revision = readFileSync("lib/coaching/logicRevision.ts", "utf8");
    const explore = readFileSync("lib/stages/explore-intent.ts", "utf8");
    expect(loop).toMatch(/officialLeadName|isConfirmOnly/);
    expect(loop).toMatch(/function onNameLead[\s\S]*officialLeadName/);
    expect(loop).toMatch(/function onProbeSave[\s\S]*officialLeadName/);
    expect(loop).toMatch(/function onPickLead[\s\S]*officialLeadName/);
    expect(loop).toMatch(/isConfirmOnly\(text\)/);
    expect(chat).toMatch(/isConfirmOnly\(text\)/);
    expect(chat).toMatch(/isConfirmOnly\(lead\)/);
    expect(turn).toMatch(/isConfirmOnly\(idea\)/);
    expect(turn).toMatch(/isConfirmOnly\(text\)/);
    expect(thin).toMatch(/isConfirmOnly\(idea\)/);
    expect(leads).toMatch(/isConfirmOnly\(text\)/);
    expect(revision).toMatch(/isConfirmOnly\(text\)/);
    expect(explore).toMatch(/isConfirmOnly\(t\)/);
  });
});

describe("QA re-verify of #76: default Body path (not just listening)", () => {
  const sheet =
    "BUS 210 Leadership essay for Prof. Kim. Using Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice) and the assigned HBR article 'What Makes a Leader?' by Daniel Goleman, write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7. Due Dec 10.";
  const prompt = "which leadership style is most effective for leading a team through change, using one real leader as your example";
  const first = "Yes, Walton visiting stores is my body example.";
  const fuller = "Also he shared profits with associates.";
  const done = "yeah that's what I want for now";
  const thesis = "Sam Walton, servant leadership";
  const body = { key: "body", title: "Body" } as const;

  it("strips leading yes/also/so/and and synthesizes a paraphrased Lead, never quoting the raw reply", () => {
    expect(isConfirmOnly(first)).toBe(false);
    expect(stripReplyFillers(first)).toBe("Walton visiting stores is my body example.");
    expect(officialLeadName(first)).toBe("Walton visiting stores is my body example.");
    expect(stripReplyFillers(fuller)).toMatch(/^He shared profits/i);
    expect(officialLeadName(fuller)).toMatch(/^He shared profits/i);
    const probed = afterProbe({ ideas: [], searchStatus: "required" }, first, false);
    expect(probed.ideas.join(" ")).toBe("Walton visiting stores is my body example.");
    expect(probed.ideas.join(" ")).not.toMatch(/^Yes,/);
    const claim = listeningClaim(probed.ideas, "Body");
    expect(claim).toBeTruthy();
    expect(claim!).not.toMatch(/^Yes,/i);
    expect(claim!).toMatch(/Walton visiting stores/i);
    const batch = exampleLeadBatch({
      concept: prompt,
      assignmentText: sheet,
      studentIdea: first,
      rubricRef: "prompt",
      section: body,
    });
    const blob = JSON.stringify(batch);
    expect(blob).not.toMatch(/You wrote “Yes, Walton visiting stores is my body example/);
    expect(blob).not.toContain("Yes, Walton visiting stores is my body example.");
    expect(batch.candidates[0]!.name).not.toMatch(/^You wrote “Yes,/);
    expect(batch.candidates[0]!.name).toMatch(/^You wrote “Walton visiting stores is my body example/);
    const synth = listeningClaim([stripReplyFillers(first)], "Body");
    expect(synth).toBeTruthy();
    expect(synth!).not.toMatch(/^Yes,/i);
  });

  it("a new fuller point is saved as a note, not as a verbatim Lead, and the cards refresh to it", () => {
    expect(looksLikeNewPoint(fuller)).toBe(true);
    expect(looksLikeNewPoint(done)).toBe(false);
    const firstSaved = afterProbe({ ideas: [], searchStatus: "required" }, first, false);
    const next = afterProbe({ ideas: firstSaved.ideas, searchStatus: "required" }, fuller, false);
    expect(next.ideas.some((i) => /^Also /i.test(i))).toBe(false);
    expect(next.ideas.join(" ")).toMatch(/shared profits/i);
    const claim = listeningClaim(next.ideas, "Body");
    expect(claim!).toMatch(/shared profits/i);
    expect(claim!).not.toMatch(/^Also /i);
    const oldBatch = JSON.stringify(exampleLeadBatch({ concept: prompt, assignmentText: sheet, studentIdea: firstSaved.ideas.at(-1) ?? "", rubricRef: "prompt", section: body }));
    const newBatch = JSON.stringify(exampleLeadBatch({ concept: prompt, assignmentText: sheet, studentIdea: next.ideas.at(-1) ?? "", rubricRef: "prompt", section: body }));
    expect(newBatch).toMatch(/shared profits/i);
    expect(newBatch).not.toBe(oldBatch);
    expect(readFileSync("components/stages/loop/coaching-loop.tsx", "utf8")).toMatch(/keptIdeas\(section\.ideas\)\.at\(-1\)/);
    expect(fallbackParaphrase(stripReplyFillers(fuller))).not.toMatch(/^Also /i);
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    const chat = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    expect(loop).toMatch(/function onNewPoint/);
    expect(chat).toMatch(/h\.newPoint/);
    expect(chat).toMatch(/looksLikeNewPoint/);
  });

  it("yeah that's what I want for now summarizes the claim, it does not only ask if they're happy", () => {
    expect(isExploreDone(done)).toBe(true);
    const ideas = afterProbe(
      { ideas: afterProbe({ ideas: [], searchStatus: "required" }, first, false).ideas, searchStatus: "required" },
      fuller,
      false,
    ).ideas;
    const claim = listeningClaim(ideas, "Body")!;
    const summary = sectionClaimSummary(claim, "Body");
    expect(summary).toMatch(/Here's what I have for your body/i);
    expect(summary).toMatch(/shared profits|visiting stores/i);
    expect(summary).not.toMatch(/I'm checking that you're happy with this idea/i);
    const chat = readFileSync("components/stages/loop/stance-chat.tsx", "utf8");
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    expect(chat).toMatch(/doneCue/);
    expect(loop).toMatch(/sectionClaimSummary/);
    expect(loop).toMatch(/listeningClaim\(kept/);
  });

  it("a thin but on-topic Walton store-visit claim gets the pressure test, not a red logic alert", () => {
    const notes = "Walton visiting stores is my body example.";
    expect(notesOnPrompt(notes, prompt, sheet, thesis)).toBe(true);
    const pizza = "The cafeteria pizza is the best part of any school day.";
    expect(notesOnPrompt(pizza, prompt, sheet, thesis)).toBe(false);
    const onTopic = logicCheckFromNotes({
      notes,
      thesis,
      assignmentText: sheet,
      rubricRef: "prompt",
      mode: "lesson",
      confirmedPrompt: prompt,
    });
    expect(onTopic.reason).not.toMatch(/doesn't answer the question your prompt asks/);
    const soft = applyOnTopicPressureTest(
      finalizeLogicCheck(onTopic, {
        assignmentText: sheet,
        studentNotes: notes,
        mode: "lesson",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["prompt"],
      }),
      notes,
    );
    expect(soft.result.tier).toBe("moderate");
    expect(soft.result.reason).toMatch(/^A reader might counter that /);
    expect((soft.result.reason.match(/\?/g) ?? []).length).toBe(1);
    const off = logicCheckFromNotes({
      notes: pizza,
      thesis,
      assignmentText: sheet,
      rubricRef: "prompt",
      mode: "lesson",
      confirmedPrompt: prompt,
    });
    expect(off.reason).toMatch(/doesn't answer the question your prompt asks/);
    const kept = applyOnTopicPressureTest(
      finalizeLogicCheck(off, {
        assignmentText: sheet,
        studentNotes: pizza,
        mode: "lesson",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["prompt"],
      }),
      pizza,
    );
    expect(kept.result.tier).toBe("strong");
    expect(kept.result.reason).toMatch(/doesn't answer the question your prompt asks/);
  });
});
