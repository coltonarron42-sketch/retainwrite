import { describe, expect, it } from "vitest";
import { guardTeachCard } from "@/lib/ai/guard";
import {
  assignSectionModes,
  extractLesson,
  guardLesson,
  isClaimSentence,
  LEADERSHIP_PROMPT,
  MIXED_PROMPT,
  resolvePromptType,
  SUMMER_PROMPT,
} from "@/lib/coaching/lesson";
import { teachThenAsk, exitTeach, teachIsDone, defaultTeachCard } from "@/lib/coaching/teach";
import { highlightReelFor, guardHighlightReel, seedLeadFromHighlight } from "@/lib/coaching/highlightReel";
import {
  assembleLeadBatch,
  assertCanAddAiLead,
  buildGoogleSearchPrompt,
  guardLeadBatch,
  searchPromptWithinCap,
  type LeadCandidate,
} from "@/lib/coaching/leadBatch";
import { RESEARCH_LEADS_MAX_PER_PAPER } from "@/lib/config";
import {
  finalizeLogicCheck,
  logicCheckFromNotes,
  logicChoice,
  LOGIC_CONTINUE,
  LOGIC_OPENER,
  LOGIC_STRONG_HEADLINE,
  stage4Complete,
  suggestsCounterargument,
} from "@/lib/coaching/logicCheck";
import {
  assertSectionStepUnlocked,
  counterargumentRequired,
  nextSectionUnlocks,
  previewWritesNothing,
  stage5Locked,
  withCounterargumentSection,
  type SectionLockState,
} from "@/lib/coaching/sectionLoop";
import { buildMemoryCard, initialSearchStatus, mirrorQuestion } from "@/lib/coaching/memoryPath";
import { renderOutlineExport } from "@/lib/coaching/outlineExport";
import { lessonLinkFor } from "@/lib/coaching/sourceCard";

const ranked = (name: string, rubricMatch: number, extra: Partial<LeadCandidate> = {}): LeadCandidate => ({
  name,
  rubricMatch,
  rubricRef: "lesson_concept",
  lessonLink: "Shows the concept",
  whyFits: "Fits the rubric criterion.",
  ...extra,
});

function section(partial: Partial<SectionLockState> & Pick<SectionLockState, "key" | "title">): SectionLockState {
  return {
    status: "open",
    teachStatus: null,
    loopStep: "teach",
    ...partial,
  };
}

describe("lesson extraction and routing", () => {
  it("reads the leadership prompt as a lesson about leadership styles", () => {
    const extracted = extractLesson(LEADERSHIP_PROMPT);
    expect(extracted.promptType).toBe("lesson");
    expect(extracted.lesson.concepts.map((item) => item.term)).toContain("leadership styles");
    expect(extracted.lesson.examplesServe).toMatch(/example/i);
    expect(LEADERSHIP_PROMPT.includes(extracted.lesson.evidence.quote)).toBe(true);
    expect(guardLesson(extracted.lesson, LEADERSHIP_PROMPT).ok).toBe(true);
  });

  it("rejects a claim-sentence lesson statement and falls back when the model fails", () => {
    expect(isClaimSentence("Leadership is the whole point of this paper.")).toBe(true);
    const bad = extractLesson(LEADERSHIP_PROMPT).lesson;
    expect(guardLesson({ ...bad, statement: "Leadership is the whole point of this paper." }, LEADERSHIP_PROMPT).ok).toBe(false);
    const fallback = extractLesson(LEADERSHIP_PROMPT, { modelFailed: true });
    expect(fallback.source).toBe("fallback");
    expect(fallback.lesson.evidence.quote.length).toBeGreaterThan(0);
  });

  it("routes summer, mixed, low confidence, and a student override", () => {
    const summer = extractLesson(SUMMER_PROMPT);
    expect(summer.promptType).toBe("personal_experience");
    expect(summer.lesson.emotionalTerms).toContain("magical");
    const summerModes = assignSectionModes(summer.promptType, [
      { key: "intro", title: "Intro", needs: "Open the story" },
      { key: "body", title: "Body", needs: "Three moments" },
    ]);
    expect(summerModes.every((item) => item.mode === "memory")).toBe(true);

    const mixed = extractLesson(MIXED_PROMPT);
    expect(mixed.promptType).toBe("mixed");
    const mixedModes = assignSectionModes(mixed.promptType, [
      { key: "style", title: "Style", needs: "Define the leadership style", concept: "leadership styles" },
      { key: "moment", title: "Moment", needs: "A time you led a group" },
    ]);
    expect(mixedModes.some((item) => item.mode === "memory")).toBe(true);
    expect(mixedModes.some((item) => item.mode === "lesson")).toBe(true);

    expect(resolvePromptType({ type: "personal_experience", confidence: 0.5 })).toBe("lesson");
    expect(resolvePromptType({ type: "lesson", confidence: 0.9 }, "personal_experience")).toBe(
      "personal_experience",
    );
  });
});

describe("TEACH", () => {
  it("rejects sentence-style qualities and keeps a real card", () => {
    const card = defaultTeachCard("servant leadership", "lesson_concept");
    expect(guardTeachCard(card).ok).toBe(true);
    expect(
      guardTeachCard({
        ...card,
        qualities: ["Servant leaders are people who serve.", "Listening first", "Helping people grow"],
      }).ok,
    ).toBe(false);
  });

  it("teaches then asks on a vague concept and probes when no concept is named", () => {
    const taught = teachThenAsk("I like servant leadership");
    expect(taught.kind).toBe("teach_then_ask");
    if (taught.kind !== "teach_then_ask") return;
    expect(taught.card.affirm?.split(/\s+/).length).toBeLessThanOrEqual(15);
    expect(taught.card.qualities.length).toBeGreaterThanOrEqual(3);
    expect(taught.card.ask.endsWith("?")).toBe(true);
    expect(teachThenAsk("I don't know").kind).toBe("thin_probe");
  });

  it("lets I know this one skip to PROBE and never blocks", () => {
    const exit = exitTeach("skipped_known");
    expect(exit.blocks).toBe(false);
    expect(teachIsDone(exit.teachStatus)).toBe(true);
    const sections = [
      section({ key: "body", title: "Body", teachStatus: null, loopStep: "teach" }),
    ];
    expect(assertSectionStepUnlocked(sections, "body", "probe").ok).toBe(false);
    sections[0]!.teachStatus = "skipped_known";
    expect(assertSectionStepUnlocked(sections, "body", "probe").ok).toBe(true);
    const intro = [
      section({
        key: "intro",
        title: "Intro",
        teachStatus: "not_applicable",
        loopStep: "probe",
      }),
    ];
    expect(assertSectionStepUnlocked(intro, "intro", "probe").ok).toBe(true);
  });
});

describe("highlight reel and leads", () => {
  it("offers a to-verify reel for Legere and drops an unknown name", () => {
    const reel = highlightReelFor({
      answer: "I want to write about John Legere",
      concept: "servant leadership",
    });
    expect(reel.dropped).toBe(false);
    expect(reel.moves.length).toBeGreaterThanOrEqual(1);
    expect(reel.moves.length).toBeLessThanOrEqual(2);
    expect(reel.toVerify).toBe(true);
    expect(reel.searchOffer).toBe(
      "Want me to search for references on how Legere was a servant leader?",
    );
    expect(guardHighlightReel(reel).ok).toBe(true);
    const seeded = seedLeadFromHighlight(reel);
    expect(seeded?.origin).toBe("student_added");
    expect(seeded?.countsTowardCap).toBe(false);

    const unknown = highlightReelFor({
      answer: "I want to write about Zzz Qqqperson",
      concept: "servant leadership",
    });
    expect(unknown.dropped).toBe(true);
    expect(unknown.moves).toEqual([]);
    expect(unknown.line).toMatch(/don't know enough/i);
  });

  it("ranks 3–5 leads, keeps one wildcard, and trims it first at the cap", () => {
    const wildcard: LeadCandidate = {
      name: "A school jazz director",
      rubricMatch: 0.2,
      rubricRef: "lesson_concept",
      lessonLink: "Shows the same pattern",
      whyFits: "Same pattern, different field.",
      isWildcard: true,
      wildcardWhy: "Music is another place this pattern shows up.",
      familyFriendly: true,
      controversyNote: "although controversial",
    };
    const batch = assembleLeadBatch({
      aiSuggestedSoFar: 0,
      candidates: [
        ranked("Ada", 0.4),
        ranked("Bea", 0.9, { interestSteered: true }),
        ranked("Cam", 0.9),
        ranked("Dee", 0.5),
      ],
      wildcard,
    });
    expect(guardLeadBatch(batch).ok).toBe(true);
    expect(batch.ranked.length).toBeGreaterThanOrEqual(3);
    expect(batch.ranked.length).toBeLessThanOrEqual(5);
    expect(batch.ranked[0]?.name).toBe("Bea");
    expect(batch.wildcard?.isWildcard).toBe(true);
    expect(batch.wildcard?.preselected).toBe(false);
    expect(batch.ranked.every((lead) => lead.preselected === false)).toBe(true);

    const atCap = assembleLeadBatch({
      aiSuggestedSoFar: 18,
      candidates: [ranked("A", 0.8), ranked("B", 0.7), ranked("C", 0.6), ranked("D", 0.5)],
      wildcard,
    });
    expect(atCap.wildcard).toBeNull();
    expect(atCap.trimmedWildcard).toBe(true);
    expect(atCap.ranked.length).toBe(2);

    expect(() => assertCanAddAiLead(RESEARCH_LEADS_MAX_PER_PAPER)).toThrow(/cap/i);
    const full = assembleLeadBatch({
      aiSuggestedSoFar: RESEARCH_LEADS_MAX_PER_PAPER,
      candidates: [ranked("A", 0.8), ranked("B", 0.7), ranked("C", 0.6)],
      wildcard,
    });
    expect(full.rejectedExtra).toBe(true);
    expect(full.ranked).toEqual([]);

    const unsafe = assembleLeadBatch({
      aiSuggestedSoFar: 0,
      under18: true,
      candidates: [ranked("A", 0.8), ranked("B", 0.7), ranked("C", 0.6)],
      wildcard: { ...wildcard, familyFriendly: false, safetyFlags: ["allegation"] },
    });
    expect(unsafe.wildcard).toBeNull();

    const twoWild = guardLeadBatch({
      ...batch,
      wildcard: batch.wildcard,
    });
    expect(twoWild.ok).toBe(true);
    expect(
      guardLeadBatch({
        ranked: [],
        wildcard: {
          ...wildcard,
          rank: null,
          isWildcard: true,
          origin: "ai_suggested",
          preselected: false,
          status: "to_verify",
          controversyNote: "shock value",
        },
        capReached: false,
        trimmedWildcard: false,
        omittedWildcardReason: null,
        rejectedExtra: false,
      }).ok,
    ).toBe(false);

    const query = buildGoogleSearchPrompt({
      section: "Body section on servant leadership",
      rubricTerms: ["ethical leadership", "three examples"],
      storyAngle: "a coach who put the team first",
    });
    expect(searchPromptWithinCap(query)).toBe(true);
  });
});

describe("memory path and logic checkpoint", () => {
  it("does not call a thin or empty note solid", () => {
    const assignment = "Explain how social media affects teen mental health.";
    for (const notes of ["idk", "yes", "Social media is bad."]) {
      const raw = logicCheckFromNotes({
        notes,
        assignmentText: assignment,
        rubricRef: "lesson_concept",
        mode: "lesson",
      });
      const finalized = finalizeLogicCheck(raw, {
        assignmentText: assignment,
        studentNotes: notes,
        mode: "lesson",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["lesson_concept"],
      });
      expect(finalized.result.tier).not.toBe("pass");
      expect(finalized.blocks).toBe(false);
    }
  });

  it("mirrors verbatim feeling words and builds a student-only memory card", () => {
    expect(mirrorQuestion(["magical"], SUMMER_PROMPT)).toBe(
      "Your prompt says “magical.” What does magical mean to you?",
    );
    expect(mirrorQuestion([], SUMMER_PROMPT)).toMatch(/What feeling/);
    const student = "The lake at night felt magical and we stayed out late";
    const card = buildMemoryCard({
      moment: "The lake at night felt magical",
      details: ["we stayed out late"],
      why: "felt magical",
      studentText: student,
      term: "magical",
    });
    expect(card.ok).toBe(true);
    expect(
      buildMemoryCard({
        moment: "A beautiful evening I imagined",
        details: [],
        why: "",
        studentText: student,
      }).ok,
    ).toBe(false);
    expect(initialSearchStatus("memory", false)).toBe("not_needed");
  });

  it("opens the logic check, keeps strong pushback non-blocking, and clamps memory sections", () => {
    expect(LOGIC_OPENER).toMatch(/logic check/i);
    expect(logicChoice("yes").blocks).toBe(false);
    expect(logicChoice("tweak").blocks).toBe(false);
    expect(logicChoice("continued")).toEqual({ advances: true, blocks: false });
    expect(LOGIC_CONTINUE).toBe("Continue anyway");
    expect(LOGIC_STRONG_HEADLINE).toBe("We would not recommend moving forward.");

    const assignment = "Evaluate leaders against ethical principles and explain your standard.";
    const strong = finalizeLogicCheck(
      logicCheckFromNotes({
        notes: "Hitler was an objectively moral leader",
        assignmentText: assignment,
        rubricRef: "ethics",
        mode: "lesson",
      }),
      {
        assignmentText: assignment,
        studentNotes: "Hitler was an objectively moral leader",
        mode: "lesson",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["ethics"],
      },
    );
    expect(strong.result.tier).toBe("strong");
    expect(strong.blocks).toBe(false);
    expect(stage4Complete([{ status: "confirmed", logicTier: "strong" }])).toBe(true);

    const debatable = finalizeLogicCheck(
      logicCheckFromNotes({
        notes: "This take is debatable but I can support it",
        assignmentText: assignment,
        rubricRef: "ethics",
        mode: "lesson",
      }),
      {
        assignmentText: assignment,
        studentNotes: "This take is debatable but I can support it",
        mode: "lesson",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["ethics"],
      },
    );
    expect(debatable.result.tier).toBe("moderate");

    const reframe = finalizeLogicCheck(
      logicCheckFromNotes({
        notes: "Hitler's leadership is a cautionary warning about charisma without ethics",
        assignmentText: assignment,
        rubricRef: "ethics",
        mode: "lesson",
      }),
      {
        assignmentText: assignment,
        studentNotes: "Hitler's leadership is a cautionary warning about charisma without ethics",
        mode: "lesson",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["ethics"],
      },
    );
    expect(reframe.result.tier).toBe("pass");

    const opinion = finalizeLogicCheck(
      {
        tier: "strong",
        basis: "debatable_interpretation",
        confidence: 0.95,
        reason: "A reader could disagree with this unpopular view.",
        citedTerm: { rubricRef: "ethics", quote: "ethical principles" },
        studentClaimRef: { ideaId: "1", quote: "I oppose the policy" },
        logicFailure: null,
        alternativeAngles: [{ question: "What evidence would a critic ask for?", rubricRef: "ethics" }],
        reframeAvailable: false,
      },
      {
        assignmentText: assignment,
        studentNotes: "I oppose the policy",
        mode: "lesson",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["ethics"],
      },
    );
    expect(opinion.result.tier).not.toBe("strong");

    const memory = finalizeLogicCheck(
      {
        tier: "strong",
        basis: "defies_logic",
        confidence: 0.99,
        reason: "The moment does not match the season in the prompt.",
        citedTerm: { rubricRef: "prompt", quote: "summer vacation" },
        studentClaimRef: { ideaId: "1", quote: "winter break" },
        logicFailure: "Season does not match",
        alternativeAngles: [{ question: "Does this moment happen in the season the prompt names?", rubricRef: "prompt" }],
        reframeAvailable: false,
      },
      {
        assignmentText: SUMMER_PROMPT,
        studentNotes: "winter break",
        mode: "memory",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["prompt"],
      },
    );
    expect(memory.result.tier).not.toBe("strong");
    expect(memory.memoryClamped).toBe(true);

    const failed = finalizeLogicCheck(null, {
      assignmentText: assignment,
      studentNotes: "",
      mode: "lesson",
      rubricRequiresCounterargument: false,
      validRubricRefs: [],
      error: true,
    });
    expect(failed.failedOpen).toBe(true);
    expect(failed.result.tier).toBe("pass");

    const withCounter = finalizeLogicCheck(
      {
        tier: "moderate",
        basis: "weak_support",
        confidence: 0.7,
        reason: "Add a counterargument before you move on.",
        citedTerm: { rubricRef: "ethics", quote: "ethical principles" },
        studentClaimRef: null,
        logicFailure: null,
        alternativeAngles: [
          { question: "Where would a counterargument fit in this section?", rubricRef: "ethics" },
        ],
        reframeAvailable: false,
      },
      {
        assignmentText: assignment,
        studentNotes: "my claim",
        mode: "lesson",
        rubricRequiresCounterargument: false,
        validRubricRefs: ["ethics"],
      },
    );
    expect(suggestsCounterargument(withCounter.result)).toBe(false);
  });
});

describe("section locking, counterargument, and outline export", () => {
  it("skips forward, locks stage 5, and ignores preview writes", () => {
    const sections = [
      section({ key: "a", title: "One", teachStatus: "explored", loopStep: "probe" }),
      section({ key: "b", title: "Two", teachStatus: null, loopStep: "teach" }),
    ];
    expect(assertSectionStepUnlocked(sections, "b", "teach").ok).toBe(false);
    expect(nextSectionUnlocks(sections, "a")).toBe(true);
    expect(stage5Locked([{ status: "skipped" }, { status: "confirmed" }])).toBe(true);
    expect(stage5Locked([{ status: "confirmed" }])).toBe(false);
    const state = { saved: true };
    expect(previewWritesNothing(state)).toBe(state);
  });

  it("adds a counterargument section only when the assignment asks", () => {
    expect(counterargumentRequired({ paperType: "argumentative", assignmentText: "Take a position." })).toBe(
      false,
    );
    expect(counterargumentRequired({ assignmentText: "Include a counterargument." })).toBe(true);
    const base = [
      { kind: "intro", title: "Intro" },
      { kind: "body", title: "Body" },
      { kind: "conclusion", title: "Conclusion" },
    ];
    expect(withCounterargumentSection(base, false, () => ({ kind: "counter", title: "Counter" }))).toEqual(
      base,
    );
    const withIt = withCounterargumentSection(
      [...base, { kind: "counter", title: "Counterargument" }],
      false,
      () => ({ kind: "counter", title: "Counterargument" }),
    );
    expect(withIt.some((item) => item.kind === "counter")).toBe(false);
  });

  it("keeps teach cards, reels, and wildcard whys out of the outline", () => {
    const text = renderOutlineExport({
      title: "Paper",
      course: "INTD",
      storyAngle: "A coach",
      thesis: "Styles show up in choices.",
      sections: [
        {
          title: "Body",
          concept: "servant leadership",
          teachAspect: "Putting the team's needs first",
          ideaNotes: ["the night shift story"],
          leader: "Legere",
          style: "servant leadership",
          excerpts: [{ quote: "He worked beside the team.", location: "p. 2" }],
          memory: null,
          teachCardDefinition: "CANARY_TEACH",
          highlightMoves: ["CANARY_REEL"],
          wildcardWhy: "CANARY_WILD",
          lessonLink: "CANARY_LESSON",
          whyFits: "CANARY_WHY",
        },
      ],
    });
    expect(text).toContain("servant leadership");
    expect(text).toContain("Putting the team's needs first");
    expect(text).toContain("the night shift story");
    expect(text).not.toContain("CANARY_TEACH");
    expect(text).not.toContain("CANARY_REEL");
    expect(text).not.toContain("CANARY_WILD");
    expect(text).not.toContain("CANARY_LESSON");
    expect(text).not.toContain("CANARY_WHY");
    expect(lessonLinkFor("servant leadership").split(/\s+/).length).toBeLessThanOrEqual(12);
  });
});
