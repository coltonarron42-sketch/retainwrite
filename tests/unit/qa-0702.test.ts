/**
 * QA 7:02 AM + 7:11 AM bundle: prepared stances, pasted readings, grounded options,
 * chapter accuracy, skips, latency signals, duplicates, polish, and the Stage 2–3 findings.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assignmentOnlyOptions,
  currentSummaries,
  dropBarePraise,
  isGetToKnowSkip,
  isSkipSaying,
  looksLikePastedReading,
  mayNeedLookup,
  optionGrounded,
  parseStance,
  verifiedSummaries,
  type MaterialSummary,
  type PaperContext,
} from "@/lib/stage1/paper-context";
import { bookLevelTitle, chapterOf, CHAPTER_CLAIM, pageShowsChapter } from "@/lib/server/paper-context/brief";
import { northstarGateFrom } from "@/lib/stage1/intake-resume";
import { smartReadingAsk } from "@/lib/config/material-policy";
import { COACH_ANSWER_SYSTEM, cleanCoachAnswer } from "@/lib/coach/answer";
import { stage2Earlier, toSecondPerson } from "@/lib/stages/stage2-intro";
import { lessonKindLabel } from "@/lib/coaching/lesson";
import { searchWhere, sourceSearchDirections } from "@/lib/coaching/exampleLeads";
import { contradictsThesis, finalizeLogicCheck, logicCheckFromNotes } from "@/lib/coaching/logicCheck";
import { substantiveNote } from "@/lib/stages/stance-turn";
import { outlineGap, outlineMap, outlinePoints } from "@/lib/stages/outline-map";

const src = (p: string) => readFileSync(p, "utf8");
const PEOPLE = [
  { label: "Mary Barra", why: "Led GM through the EV shift." },
  { label: "Satya Nadella", why: "Changed Microsoft's culture." },
];
const OPTIONS = [
  { label: "Transformational leadership", why: "Inspires people to buy in." },
  { label: "Team management", why: "Balances task and people." },
];

describe("1. prepared student stance (walk C)", () => {
  it("parses 'I want to argue transformational leadership, using Satya Nadella'", () => {
    const s = parseStance("I want to argue transformational leadership, using Satya Nadella", OPTIONS, PEOPLE);
    expect(s?.stance).toMatch(/transformational/i);
    expect(s?.leader).toBe("Satya Nadella");
  });
  it("finds a stance inside an 'I've read it' answer, and a leader not in the list", () => {
    const s = parseStance("Yeah I've read both. I'm going to argue transformational leadership with Indra Nooyi as my example.", OPTIONS, PEOPLE);
    expect(s?.leader).toBe("Indra Nooyi");
  });
  it("the intake saves a stance from any answer and skips what it answers", () => {
    const intake = src("components/stages/stage1/assignment-intake.tsx");
    expect(intake).toContain("parseStance(text, bNow?.options?.options ?? [], people)");
    expect(intake).toContain('slot: "leader", named: said.leader');
    // No second "Which direction…?" after the decision on north-star papers.
    expect(intake).toContain("!(brief.northstar && brief.decision)");
  });
  it("a stance said before the confirm is saved too", () => {
    const confirm = src("components/stages/stage1/pau-pau-confirm.tsx");
    expect(confirm).toContain("parseStance(text)");
    expect(confirm).toContain('source: "stated"');
  });
});

describe("2. pasted text and invented options (walk B)", () => {
  const reading =
    "The quiet kitchen study followed forty families over one school year. Researchers recorded dinner conversations twice a week. " +
    "Families who ate together at least four nights a week reported longer conversations. The effect was strongest for younger children. " +
    "Parents described the meal as the one time the whole family was in the same room. The authors caution that the sample was small and local.";
  it("a long typed reading is material, not a pick", () => {
    expect(looksLikePastedReading(reading, 0)).toBe(true);
    expect(looksLikePastedReading("I think transformational fits best because Nadella changed Microsoft's culture and people bought in. " + "I liked it a lot. ".repeat(10), 0)).toBe(false);
  });
  const ASG = "Read the handout “Notes on the Quiet Kitchen” and write 500 words on whether family dinner rules help kids talk more. Take a position and support it.";
  it("rejects options invented for an unseen handout", () => {
    expect(optionGrounded("No phones or screens at the table", ASG)).toBe(false);
    expect(optionGrounded("A no-device rule", ASG)).toBe(false);
    expect(optionGrounded("Family dinner rules help kids talk more", ASG)).toBe(true);
    expect(optionGrounded("Agree", ASG)).toBe(true);
  });
  it("falls back to options from the assignment's own question", () => {
    expect(assignmentOnlyOptions(ASG).map((o) => o.label)).toEqual(["Yes", "No", "It depends"]);
    expect(assignmentOnlyOptions("Explain whether you agree with the author.").map((o) => o.label)).toContain("Agree");
  });
  it("options are built only from verified material, never her own knowledge", () => {
    const ctx: PaperContext = {
      v: 1,
      summaries: [
        { kind: "knowledge", title: "Quiet Kitchen", points: ["invented"], at: 1 } as MaterialSummary,
        { kind: "assignment", title: "your assignment sheet", points: ["real"], at: 2 } as MaterialSummary,
      ],
    };
    expect(verifiedSummaries(ctx).flatMap((s) => s.points)).toEqual(["real"]);
    const brief = src("lib/server/paper-context/brief.ts");
    expect(brief).toContain("optionGrounded(");
    expect(brief).toContain("you know NOTHING about what the assigned readings say");
  });
});

describe("3. chapter accuracy", () => {
  it("knowledge is book-level and labeled; chapter claims need a page that shows the chapter", () => {
    expect(chapterOf("Northouse, Leadership: Theory and Practice, Ch. 4")).toBe("4");
    expect(bookLevelTitle("Northouse's Leadership: Theory and Practice, Ch. 4")).toBe("Northouse's Leadership: Theory and Practice (the book overall)");
    expect(CHAPTER_CLAIM.test("Chapter 4 covers the skills approach")).toBe(true);
    expect(pageShowsChapter("Contents ... Chapter 4 The Skills Approach ...", "4")).toBe(true);
    expect(pageShowsChapter("Chapter 14 Leadership Ethics", "4")).toBe(false);
  });
  it("she asks which edition when the chapter isn't verified", () => {
    const ask = smartReadingAsk([{ title: "Northouse's Leadership: Theory and Practice, Ch. 4", known: true, offers: [] }]);
    expect(ask).toMatch(/which edition/i);
    expect(src("app/api/papers/[paperId]/intake/brief/route.ts")).toContain("Chapter numbers change between editions");
    // Book-level knowledge only (no missing reading): the edition ask still shows.
    expect(src("app/api/papers/[paperId]/intake/brief/route.ts")).toContain("missingAskFor(ctx) ?? chapterAsk(ctx)");
  });
  it("the coach, the voice persona and the confirm reply carry the chapter rule", () => {
    // PC-31: positive wording (chapter contents only from text in the paper context).
    expect(COACH_ANSWER_SYSTEM).toMatch(/Page numbers, chapter contents and quotes come only from text in the paper context/);
    expect(src("lib/voice/realtime/persona.ts")).toMatch(/say what a numbered chapter contains only when the paper context has that chapter's actual content/i);
    expect(src("lib/stage1/confirm-reply.ts")).toMatch(/never say what a numbered chapter/i);
  });
});

describe("4. skip", () => {
  it("recognizes skips", () => {
    expect(isGetToKnowSkip("Skip the get-to-know-you questions")).toBe(true);
    expect(isGetToKnowSkip("can we skip the personal stuff")).toBe(true);
    expect(isSkipSaying("skip")).toBe(true);
    expect(isSkipSaying("n/a")).toBe(true);
    expect(isSkipSaying("I'd skip the intro and start with Barra")).toBe(false);
  });
  it("skipping everything never passes the gate", () => {
    const g = northstarGateFrom({
      answers: [
        { questionId: "material_check", answerText: "skip" },
        { questionId: "decision_pick", answerText: "skip" },
        { questionId: "decision_why", answerText: "n/a" },
      ],
      decisionAnswer: "skip",
      needsLeader: true,
      leaderAnswer: null,
    });
    expect(g).toEqual({ catchUpDone: false, decided: false });
    const done = northstarGateFrom({
      answers: [{ questionId: "decision_why", answerText: "because it helps a team buy into change" }],
      decisionAnswer: "Transformational, because it helps a team buy into change",
      materialShown: true,
    });
    expect(done).toEqual({ catchUpDone: true, decided: true });
  });
  it("the server gate rejects a skipped-through north-star Stage 1", () => {
    const route = src("app/api/papers/[paperId]/intake/complete/route.ts");
    expect(route).toContain("northstarGateFrom(");
    expect(route).toContain('"Early stance needs at least 25 words"');
    expect(route).toContain('"Pick a story angle before finishing Stage 1"');
  });
});

describe("5. latency", () => {
  it("flags messages that may need a lookup at send time", () => {
    expect(mayNeedLookup("what does chapter 4 say?")).toBe(true);
    expect(mayNeedLookup("who is a real example")).toBe(true);
    expect(mayNeedLookup("ok")).toBe(false);
    expect(src("components/stages/stage1/pau-pau-confirm.tsx")).toMatch(/if \(mayNeedLookup\(text\)\) \{\s*setReplyStatus\("Digging it up…"\)/);
    expect(src("components/stages/loop/stance-chat.tsx")).toContain('setLookupNote(mayNeedLookup(text) ? "Digging it up…" : "Thinking…")');
    expect(src("components/stages/stage1/assignment-intake.tsx")).toContain("videoAhead.set(paperId, moreFetch(paperId, \"video\"))");
  });
});

describe("6. duplicates", () => {
  it("each reading once, with one label", () => {
    const ctx: PaperContext = {
      v: 1,
      summaries: [
        { kind: "knowledge", title: "Goleman, What Makes a Leader", points: ["a"], at: 1 } as MaterialSummary,
        { kind: "found", title: "Goleman, What Makes a Leader", points: ["b"], at: 2 } as MaterialSummary,
      ],
    };
    const list = currentSummaries(ctx);
    expect(list).toHaveLength(1);
    expect(list[0]!.kind).toBe("found");
  });
  it("a get-to-know skip with nothing else left moves on, never back to question 1", () => {
    expect(src("components/stages/stage1/assignment-intake.tsx")).toContain("finishCoaching(answersAfterSkippingInterest(answers));");
  });
  it("material shown before the confirm is never re-asked", () => {
    expect(src("components/stages/stage1/assignment-intake.tsx")).toContain('if (!brief?.materialShown || has("material_check"))');
  });
});

describe("7. polish", () => {
  it("Stage 2 paraphrases the decision", () => {
    expect(toSecondPerson("I think my team")).toBe("you think your team");
    expect(stage2Earlier({ question: "q", pick: "Transformational leadership", answer: "I'd pick transformational because I think it helps my team buy into change", at: 1 }, { question: "q", pick: "Satya Nadella", answer: "x", at: 1 })).toBe(
      "Earlier you picked Transformational leadership with Satya Nadella as your example, because you think it helps your team buy into change. That's a solid reason to build on.",
    );
  });
  it("an argument essay isn't labeled Lesson", () => {
    expect(lessonKindLabel("Write an argumentative essay: take a position on whether…")).toBe("Argument");
    expect(lessonKindLabel("Analyze how a leader used one style.")).toBe("Analysis");
    expect(lessonKindLabel("Summarize the reading.")).toBe("Lesson");
  });
  it("the leader chip says to finish the sentence", () => {
    expect(src("components/stages/stage1/assignment-intake.tsx")).toContain("Tap one, then finish the sentence with your reason.");
  });
  it("no TO VERIFY labels, no JSTOR for the textbook", () => {
    for (const f of ["components/coaching/lead-batch.tsx", "components/stages/loop/stance-chat.tsx", "components/stages/loop/coaching-loop.tsx", "lib/coaching/highlightReel.ts"]) {
      expect(src(f)).not.toMatch(/>To verify<|To verify:|\. To verify\./);
    }
    expect(searchWhere("Northouse leadership theory and practice")).not.toMatch(/JSTOR/);
    expect(sourceSearchDirections("teen mental health")).toMatch(/JSTOR/);
  });
});

describe("7:11 (a) the logic check names a contradiction", () => {
  const thesis = "I'd pick team management because Mary Barra used it to get GM through the shift to electric cars, and it worked.";
  const notes = "team management is bad for change and transformational is way better, so Barra probably did it wrong";
  it("the exact QA case raises the soft alert, never 'No holes'", () => {
    expect(contradictsThesis(notes, thesis)?.term).toBe("team management");
    const raw = logicCheckFromNotes({
      notes,
      thesis,
      assignmentText: "Analyze how a real leader used a leadership style to lead change. Use one real leader.",
      rubricRef: "conclusion",
      mode: "lesson",
      confirmedPrompt: "How did a real leader use a leadership style to lead change?",
    });
    const fin = finalizeLogicCheck(raw, { assignmentText: "x", studentNotes: notes, mode: "lesson", rubricRequiresCounterargument: false, validRubricRefs: ["conclusion", "ethics", "prompt"] });
    expect(fin.result.tier).toBe("moderate");
    expect(fin.result.reason).toMatch(/your thesis says/);
    expect(src("components/stages/loop/stance-chat.tsx")).not.toMatch(/No holes\. I looked|I'm a little impressed|That tracks/);
  });
  it("a consistent conclusion passes", () => {
    expect(contradictsThesis("So team management is how Barra got GM through it.", thesis)).toBeNull();
  });
});

describe("7:11 (b) a new substantive reply is saved, not turned away", () => {
  it("substantiveNote", () => {
    expect(substantiveNote("The reader needs to know GM was losing ground to Tesla before Barra took over in 2014.")).toBe(true);
    expect(substantiveNote("yes")).toBe(false);
    expect(substantiveNote("what should the intro say?")).toBe(false);
    expect(src("components/stages/loop/stance-chat.tsx")).toContain('(kind === "confirm" || kind === "logic_opener") && substantiveNote(text)');
  });
});

describe("7:11 (c) Stage 3 shows an editable outline and coaches gaps", () => {
  it("maps sections with purpose and the student's own points", () => {
    const rows = outlineMap(
      [
        { key: "intro", title: "Introduction", ideas: ["I argue Barra used team management. It worked because people bought in."] },
        { key: "body", title: "Body", ideas: [] },
      ],
      ["intro"],
      { key: "body", text: "GM's EV shift" },
    );
    expect(rows[0]!.points).toEqual(["I argue Barra used team management.", "It worked because people bought in."]);
    expect(rows[0]!.purpose.length).toBeGreaterThan(10);
    expect(rows[1]!.current).toBe(true);
    expect(outlineGap("Body", outlinePoints("GM's EV shift"))).toMatch(/reason or example/);
    expect(outlineGap("Body", [])).toMatch(/no points yet/);
    expect(src("components/stages/loop/outline-chat.tsx")).toContain("data-outline-map");
  });
});

describe("7:11 (d) no hollow praise", () => {
  it("bare praise is dropped; specific praise stays", () => {
    expect(dropBarePraise("Nice!")).toBe("");
    expect(dropBarePraise("That tracks.")).toBe("");
    expect(cleanCoachAnswer(["Nice. What's your reason?"])).toEqual(["What's your reason?"]);
    expect(src("components/stages/loop/stance-chat.tsx")).not.toContain("got legs");
  });
});

describe("decision ask without grounded options", () => {
  it("uses the assignment's own terms, never guessed options", async () => {
    const { assignmentDecisionAsk } = await import("@/lib/stage1/paper-context");
    expect(assignmentDecisionAsk("write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader")).toBe(
      "Which leadership style do you want to argue is most effective for leading a team through change, and why? Name it in your own words.",
    );
  });
});

describe("preview walk follow-ups (a85a5e1)", () => {
  it("'arguing which…' is an Argument", () => {
    expect(lessonKindLabel("write 1,200-1,500 words arguing which leadership style is most effective")).toBe("Argument");
  });
  it("a stated stance plus its reason reads as one paraphrased line", () => {
    expect(
      stage2Earlier({ question: "q", pick: "their own", answer: "I want to argue transformational leadership, using Satya Nadella. Because he got a huge company to change by inspiring people.", at: 1 }),
    ).toBe("Earlier you told me you want to argue transformational leadership, using Satya Nadella, because he got a huge company to change by inspiring people.");
  });
  it("Stage 2 'Digging it up…' stays up while her answer loads", () => {
    expect(src("components/stages/loop/stance-chat.tsx")).toContain("lookupNote && (checking || props.busy)");
  });
  it("no 'from your assignment' attribution for options she knows herself", () => {
    expect(COACH_ANSWER_SYSTEM).toMatch(/say options, styles or ideas come from the assignment or a reading only when its text lists them/);
  });
});

describe("preview walk follow-ups (56237e1)", () => {
  it("a vague pick with no grounded options asks them to name it, never 'which one' from an unseen list", async () => {
    const { vaguePickProbe } = await import("@/lib/stage1/paper-context");
    const t = vaguePickProbe("idk, the team one I guess", []);
    expect(t).toMatch(/Name it in your own words/);
    expect(t).not.toMatch(/leaning toward/);
  });
  it("the readback's ask also yields the assignment-terms decision question", async () => {
    const { assignmentDecisionAsk } = await import("@/lib/stage1/paper-context");
    expect(
      assignmentDecisionAsk("Write a 1,200-1,500 word essay that argues which leadership style works best for leading a team through change and uses one real leader as your example."),
    ).toMatch(/^Which leadership style do you want to argue works best for leading a team through change/);
  });
});

describe("preview walk follow-ups (7a11df1)", () => {
  it("a prepared or skip-all student is never parked on the left-out voice question", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).toContain("const fallbackOff = Boolean(brief?.northstar);");
    expect(intake.match(/!fallbackOff &&/g)?.length).toBeGreaterThanOrEqual(2);
    expect(intake).toContain("voice.needsFallback && !fallbackOff");
  });
});
