"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DsButton } from "@/components/ui/ds-button";
import { CoachEyebrow, CoachSays } from "@/components/coaching/pau-pau";
import { asQuestion, isQuestionTopic } from "@/lib/copy/topic-phrase";
import { dsBody, dsCaption, dsCard, dsEyebrow, dsH1, dsLabel, dsLink, dsSelect, dsTextarea } from "@/lib/ds/classes";
import { LeadBatchView } from "@/components/coaching/lead-batch";
import { LogicCheckpoint } from "@/components/coaching/logic-checkpoint";
import { MemoryTriggerList } from "@/components/coaching/memory-triggers";
import { TeachCardView } from "@/components/coaching/teach-card";
import { VoiceNote } from "@/components/coaching/voice-note";
import { VoiceNudge } from "@/components/coaching/voice-nudge";
import {
  coachingSubject,
  exampleLeadBatch,
  sourceSearchDirections,
  stageLessonHeader,
  subjectMidSentence,
  visibleSourceLead,
} from "@/lib/coaching/exampleLeads";
import {
  assembleLeadBatch,
  buildGoogleSearchPrompt,
  type PreparedLead,
} from "@/lib/coaching/leadBatch";
import {
  assignSectionModes,
  extractLesson,
  type LessonExtraction,
  type PromptType,
} from "@/lib/coaching/lesson";
import {
  finalizeLogicCheck,
  logicCheckFromNotes,
  type FinalizedLogic,
} from "@/lib/coaching/logicCheck";
import { highlightReelFor, seedLeadFromHighlight } from "@/lib/coaching/highlightReel";
import {
  LESSON_PROBE_OPENER,
  MEMORY_CONFIRM,
  MEMORY_PROBE_OPENER,
  mirrorQuestion,
} from "@/lib/coaching/memoryPath";
import {
  SCRIPTED_MEMORY_FOLLOW_UP,
  safetyNoteFor,
  triggersForStudent,
  type MemoryTrigger,
} from "@/lib/coaching/memoryTriggers";
import { lessonLinkFor } from "@/lib/coaching/sourceCard";
import { stage5Locked, type SectionLockState } from "@/lib/coaching/sectionLoop";
import { draftingAnchors } from "@/lib/drafting/anchors";
import { requestHiddenDraftMilestone } from "@/lib/drafting/requestMilestone";
import { DraftingStage } from "@/components/stages/drafting/drafting-stage";
import { FEATURES, STAGE_LABELS } from "@/lib/config";
import {
  advanceProductStage,
  healStuckOutlineSession,
  productStageBounce,
  progressAfterLogicContinue,
  sectionContinueTarget,
} from "@/lib/stages/advance";
import type { StageProgressRow } from "@/lib/stages/assert";
import { defaultTeachCard, teachThenAsk, type TeachStatus } from "@/lib/coaching/teach";
import {
  checklistItem5Resolved,
  VOICE_NUDGE_EVENTS,
} from "@/lib/coaching/voiceNudge";
import { usePasteMeta } from "@/lib/hooks/use-paste-meta";
import { computeStyleMetrics } from "@/lib/style/metrics";
import { evaluateMismatch } from "@/lib/style/mismatch";
import {
  summarizeCountedAnswers,
  voiceNoteForStage,
  type CountedAnswer,
} from "@/lib/style/voiceBaseline";
import { applyOutlineDrafts } from "@/lib/papers/outline";
import { draftPointer } from "@/lib/papers/draft-resume";
import { persistField } from "@/lib/papers/persist";
import { useDraftSave } from "@/lib/papers/use-draft-save";
import { SaveStatus } from "@/components/stages/save-status";
import { refreshStoredLogic, replaceClaim, revisionPrefill } from "@/lib/coaching/logicRevision";
import { keptIdeas, probeForThinNote } from "@/lib/coaching/thin";
import { wordCount } from "@/lib/utils";

type RuntimeSection = {
  key: string;
  title: string;
  needs: string;
  kind: string;
  mode: "lesson" | "memory";
  concept: string | null;
  rubricRef: string;
  teachStatus: TeachStatus | null;
  teachAspect: string | null;
  ideas: string[];
  loopStep: SectionLockState["loopStep"];
  status: SectionLockState["status"];
  searchStatus: "required" | "not_needed";
  chosenLead: string | null;
  logic: FinalizedLogic | null;
  logicRevealed: boolean;
  continued: boolean;
};

type Session = {
  assignmentText: string;
  extraction: LessonExtraction;
  sections: RuntimeSection[];
  hiddenTriggers: string[];
  triggerRefresh: number;
  activeTrigger: string | null;
  safetyNote: string;
  activeIndex: number;
  answers: CountedAnswer[];
  draft: string;
  nudgeKept: boolean;
  nudgeRework: boolean;
  events: string[];
};

type Props = {
  paperId: string;
  stage: number;
  assignmentPrompt: string | null;
  confirmedTopic?: string | null;
  confirmedPrompt?: string | null;
  storyAnswer?: string | null;
  savedBeat?: unknown;
  persist?: boolean;
  stageProgress?: StageProgressRow[];
  onStageProgress?: (
    progress: StageProgressRow[],
    currentStage: number,
  ) => void | boolean | Promise<void | boolean>;
};

function storageKey(paperId: string) {
  return `rw_loop_${paperId}`;
}

function buildSections(extraction: LessonExtraction): RuntimeSection[] {
  const concept = extraction.lesson.concepts[0]?.term ?? null;
  const seeds = [
    { key: "intro", title: "Introduction", needs: "Introduce the work", kind: "intro", concept: null },
    {
      key: "body",
      title: "Body",
      needs:
        extraction.promptType === "mixed"
          ? "A time you used the idea"
          : "Develop the main examples",
      kind: "body",
      concept,
    },
    { key: "conclusion", title: "Conclusion", needs: "Close the paper", kind: "conclusion", concept: null },
  ];
  return assignSectionModes(extraction.promptType, seeds).map((section) => {
    const memory = section.mode === "memory";
    const teachStatus: TeachStatus | null =
      !memory && !section.concept ? "not_applicable" : null;
    return {
      ...section,
      rubricRef: "lesson_concept",
      teachStatus,
      teachAspect: null,
      ideas: [],
      loopStep: teachStatus === "not_applicable" ? "probe" : "teach",
      status: "open",
      searchStatus: memory ? "not_needed" : "required",
      chosenLead: null,
      logic: null,
      logicRevealed: false,
      continued: false,
    };
  });
}

function freshSession(assignmentText: string): Session {
  const extraction = extractLesson(assignmentText);
  return {
    assignmentText,
    extraction,
    sections: buildSections(extraction),
    activeIndex: 0,
    hiddenTriggers: [],
    triggerRefresh: 0,
    activeTrigger: null,
    safetyNote: "",
    answers: [],
    draft: "",
    nudgeKept: false,
    nudgeRework: false,
    events: [`prompt_type_classified:${extraction.promptType}`],
  };
}

export function CoachingLoop({
  paperId,
  stage,
  assignmentPrompt,
  confirmedTopic = null,
  confirmedPrompt = null,
  storyAnswer = null,
  savedBeat = null,
  persist = true,
  stageProgress = [],
  onStageProgress,
}: Props) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  // False until the saved session (or the Stage 1 assignment) has been read.
  // Before that, show a loading line, not the paste box: the confirmed
  // assignment is on its way and must not be asked for again.
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [idea, setIdea] = useState("");
  const replacingClaim = useRef(false);
  const outlineDrafts = useRef<Record<string, string>>({});
  const [thinNote, setThinNote] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [moving, setMoving] = useState(false);
  const noteStatus = useDraftSave({
    paperId,
    fieldKey: `stance:${session?.sections[active]?.key ?? "note"}:draft`,
    text: idea,
    enabled: persist && stage === 2 && Boolean(session),
    resume: draftPointer({ stage: 2, sectionKey: session?.sections[active]?.key ?? null }),
  });
  const paste = usePasteMeta();
  // The shell passes a fresh stageProgress array on every render. Read it from
  // a ref so a parent re-render does not reload the saved session over the
  // student's live progress (it reset Stance to the first section's leads).
  const stageProgressRef = useRef(stageProgress);
  useEffect(() => {
    stageProgressRef.current = stageProgress;
  }, [stageProgress]);

  useEffect(() => {
    let cancelled = false;
    const savedRaw = window.localStorage.getItem(storageKey(paperId));
    const saved = savedRaw ? (JSON.parse(savedRaw) as Session) : null;
    const finish = (
      base: Session | null,
      drafts: { fieldKey: string; text: string }[],
      sectionKey?: string | null,
      resume?: { stage?: number; screen?: string | null } | null,
    ) => {
      if (cancelled) return;
      setSessionLoaded(true);
      if (!base?.sections) {
        const text = assignmentPrompt?.trim() || "";
        setSession(text ? freshSession(text) : null);
        return;
      }
      const incoming = assignmentPrompt?.trim() || "";
      if (incoming && !base.assignmentText?.trim()) {
        const extraction = extractLesson(incoming);
        base.assignmentText = incoming;
        base.extraction = extraction;
      }
      base.sections = applyOutlineDrafts(base.sections, drafts).map((section) => {
        if (section.loopStep !== "logic_check" || section.ideas.length === 0) return section;
        const refreshed = refreshStoredLogic(section, {
          assignmentText: base.assignmentText,
          rubricRef: section.rubricRef,
          mode: section.mode,
        });
        return { ...section, ideas: refreshed.ideas, logic: refreshed.logic };
      });
      const healed = healStuckOutlineSession({
        currentStage: stage,
        progress: stageProgressRef.current,
        sections: base.sections,
        resume,
      });
      if (healed.healed && healed.resume) {
        base.sections = healed.sections;
        if (persist) {
          void persistField(paperId, {
            fieldKey: "loop_session",
            text: JSON.stringify(base),
            submitted: true,
            resume: healed.resume,
            session: base,
          });
        }
      }
      for (const section of base.sections) {
        outlineDrafts.current[section.key] = keptIdeas(section.ideas).join("\n");
      }
      setSession(base);
      const index = sectionKey ? base.sections.findIndex((item) => item.key === sectionKey) : base.activeIndex ?? 0;
      setActive(index >= 0 ? index : 0);
    };
    if (!persist) {
      finish(saved, []);
      return;
    }
    void fetch(`/api/papers/${paperId}/autosave`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: { session?: Session; drafts?: { fieldKey: string; text: string }[]; resume?: { stage?: number; screen?: string | null; sectionKey?: string } } | null) => {
        const remote = data?.session?.sections ? data.session : null;
        finish(remote ?? saved, data?.drafts ?? [], data?.resume?.sectionKey, data?.resume);
      })
      .catch(() => finish(saved, []));
    return () => {
      cancelled = true;
    };
  }, [paperId, assignmentPrompt, persist, stage]);

  useEffect(() => {
    if (!session) return;
    window.localStorage.setItem(storageKey(paperId), JSON.stringify(session));
  }, [paperId, session]);

  useEffect(() => {
    if (!session) return;
    const bounce = productStageBounce({
      stage,
      progress: stageProgress,
      sections: session.sections,
    });
    if (bounce === "stance") {
      router.replace(`/app/papers/${paperId}/stage/2`);
    }
  }, [paperId, router, session, stage, stageProgress]);

  const section = session?.sections[active];
  const totals = useMemo(
    () => summarizeCountedAnswers(session?.answers ?? []),
    [session?.answers],
  );
  const voice = voiceNoteForStage(stage, {
    naturalWords: totals.naturalWords,
    pastedShare: totals.pastedShare,
    hasBaseline: totals.hasBaseline,
  });

  if (!session) {
    if (!sessionLoaded) {
      return (
        <p className="text-sm text-rw-ink/70" role="status">
          Pau Pau is pulling up your confirmed assignment…
        </p>
      );
    }
    return (
      <AssignmentSeed
        paperId={paperId}
        onUse={(text) => {
          setSession(freshSession(text));
          setActive(0);
        }}
      />
    );
  }

  const lesson = session.extraction.lesson;
  const subject = coachingSubject({
    confirmedTopic,
    confirmedPrompt,
    concept: lesson.concepts[0]?.term,
    assignmentText: session.assignmentText,
  });
  const inStance = stage === 2;
  const locks = stage5Locked(session.sections);
  const skipped = session.sections.filter((item) => item.status === "skipped");

  function commit(next: Session) {
    window.localStorage.setItem(storageKey(paperId), JSON.stringify(next));
    setSession(next);
  }

  function updateSection(key: string, patch: Partial<RuntimeSection>, extra?: Partial<Session>) {
    if (!session) return;
    commit({
      ...session,
      ...extra,
      sections: session.sections.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    });
  }

  function log(event: string) {
    const raw = window.localStorage.getItem(storageKey(paperId));
    const current = raw ? (JSON.parse(raw) as Session) : session;
    if (!current) return;
    commit({ ...current, events: [...current.events, event] });
  }

  async function saveLoop(next: Session, fieldKey: string, text: string, resume: { stage: number; sectionKey?: string }) {
    if (!persist) return true;
    const ok = await persistField(paperId, {
      fieldKey,
      text,
      submitted: true,
      resume: { ...resume, screen: "stance" },
      session: next,
    });
    if (!ok) setThinNote("Couldn't save. Your note is still here.");
    return ok;
  }

  async function persistAndGo(progress: StageProgressRow[], nextStage: number) {
    setMoving(true);
    const saved = await onStageProgress?.(progress, nextStage);
    if (saved === false) {
      setMoving(false);
      return;
    }
    if (nextStage !== stage) {
      router.push(`/app/papers/${paperId}/stage/${nextStage}`);
    } else {
      setMoving(false);
    }
  }

  async function continueAfterLogic(choice: "pass" | "keep" | "continued") {
    if (!session || !section) return;
    const sections = session.sections.map((item, index) =>
      index === active
        ? {
            ...item,
            status: "confirmed" as const,
            loopStep: "confirmed" as const,
            continued: choice === "continued",
          }
        : item,
    );
    const target = sectionContinueTarget(sections, active);
    const result = progressAfterLogicContinue(
      stageProgress,
      target.kind === "section" ? "section" : "outline",
    );
    const nextIndex = target.kind === "section" ? target.index : active;
    commit({
      ...session,
      sections,
      activeIndex: nextIndex,
      events: [
        ...session.events,
        choice === "continued" ? "logic_strong_continued" : "section_confirmed",
      ],
    });
    if (target.kind === "section") setActive(nextIndex);
    if (persist) {
      // Save on every confirm so a reload resumes at the next section.
      const savedSession = { ...session, sections, activeIndex: nextIndex };
      await persistField(paperId, {
        fieldKey: "loop_session",
        text: JSON.stringify(savedSession),
        submitted: true,
        resume:
          target.kind === "outline"
            ? { stage: 3, screen: "outline" }
            : { stage: 2, sectionKey: sections[nextIndex]?.key ?? null, screen: "stance" },
        session: savedSession,
      });
    }
    persistAndGo(result.progress, result.nextStage);
    if (stage >= 2 && stage <= 4) {
      requestHiddenDraftMilestone(paperId, {
        trigger: "section_complete",
        stage,
        promptType: session.extraction.promptType,
        storyAngle: lesson.statement,
        thesis: session.answers.map((answer) => answer.text).slice(-1)[0] ?? "",
        sections: sections.map((item) => ({
          key: item.key,
          title: item.title,
          kind: item.kind,
          ideas: item.ideas,
        })),
      });
    }
  }

  function continueProductStage() {
    const result = advanceProductStage(stageProgress, stage);
    persistAndGo(result.progress, result.nextStage);
    if (stage === 3 && session) {
      requestHiddenDraftMilestone(paperId, {
        trigger: "outline_approved",
        stage: 3,
        promptType: session.extraction.promptType,
        storyAngle: lesson.statement,
        thesis: session.answers.map((answer) => answer.text).slice(-1)[0] ?? "",
        sections: session.sections.map((item) => ({
          key: item.key,
          title: item.title,
          kind: item.kind,
          ideas: item.ideas,
        })),
      });
    }
  }

  const card =
    section?.mode === "lesson" && section.concept
      ? defaultTeachCard((subject === "your topic" ? section.concept : subject).slice(0, 60), section.rubricRef)
      : null;
  const followUp = section?.mode === "lesson" && idea.trim() ? teachThenAsk(idea) : null;
  const examples =
    section && section.mode === "lesson"
      ? exampleLeadBatch({
          concept: subject === "your topic" ? section.concept : subject,
          assignmentText: subject === "your topic" ? session.assignmentText : subject,
          studentIdea: keptIdeas(section.ideas).join(" "),
          rubricRef: section.rubricRef,
        })
      : null;
  const batch =
    examples?.personalized
      ? assembleLeadBatch({
          candidates: examples.candidates,
          wildcard: examples.wildcard,
          aiSuggestedSoFar: session.answers.filter((answer) => answer.kind === "probe").length > 8 ? 20 : 0,
          under18: false,
        })
      : null;

  const draftMetrics = session.draft.trim() ? computeStyleMetrics(session.draft) : null;
  const sampleText = session.answers.map((answer) => answer.text).join("\n");
  const sampleMetrics = sampleText.trim() ? computeStyleMetrics(sampleText) : null;
  const mismatch =
    draftMetrics && sampleMetrics
      ? evaluateMismatch(draftMetrics, sampleMetrics, [], session.draft, {
          naturalWords: totals.naturalWords,
        })
      : null;

  return (
    <div className="mx-auto max-w-3xl pb-24">
      {moving ? (
        <p className="mb-4 text-sm font-medium text-rw-ink" role="status">
          Opening the next stage…
        </p>
      ) : null}
      {stage === 2 ? (
        <>
      <CoachEyebrow label="What you're learning" />
      <h1 className={`mt-2 ${dsH1}`}>
        {stageLessonHeader(subject, lesson.statement)}
      </h1>
      <p className={`mt-3 ${dsBody}`}>
        {session.extraction.promptType === "personal_experience"
          ? "This looks like a personal-story assignment. We'll help you remember and tell it."
          : subject === "your topic"
            ? "The assignment topic is still missing. Add it on the checklist before this lesson."
            : isQuestionTopic(subject)
              ? `This assignment asks: ${asQuestion(subject)}`
              : `This assignment teaches ${subjectMidSentence(subject)}.`}{" "}
        <a
          href={`/app/papers/${paperId}/stage/1`}
          className={dsLink}
        >
          Edit assignment
        </a>
      </p>
        </>
      ) : (
        <p className={dsEyebrow}>
          Stage {stage} of {STAGE_LABELS.length} · {STAGE_LABELS[stage - 1]}
        </p>
      )}
      {stage === 2 ? (
      <label className={`mt-4 block ${dsCaption}`}>
        Prompt type
        <select
          className={`mt-1 max-w-[240px] ${dsSelect}`}
          value={session.extraction.promptType}
          onChange={(event) => {
            const promptType = event.target.value as PromptType;
            const extraction = extractLesson(session.assignmentText, { studentPromptType: promptType });
            commit({
              ...session,
              extraction: { ...extraction, promptType, source: "ai" },
              sections: buildSections({ ...extraction, promptType }),
              events: [...session.events, "prompt_type_changed"],
              activeIndex: 0,
            });
            setActive(0);
          }}
        >
          <option value="lesson">Lesson</option>
          <option value="personal_experience">Personal experience</option>
          <option value="mixed">Mixed</option>
        </select>
      </label>
      ) : null}

      {stage === 2 ? (
      <ol className="mt-6 flex flex-wrap gap-2">
        {session.sections.map((item, index) => (
          <li key={item.key}>
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-sm ${index === active ? "bg-rw-ink text-white" : "bg-white text-rw-ink"}`}
              onClick={() => {
                setActive(index);
                commit({ ...session, activeIndex: index });
              }}
            >
              {item.title}
              {item.status === "skipped" ? " · Skipped" : ""}
            </button>
          </li>
        ))}
      </ol>
      ) : null}

      {stage === 2 && section ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-rw-ink/70">{section.needs}</p>
          {inStance && section.mode === "lesson" && section.loopStep === "teach" && card ? (
            <TeachCardView
              card={card}
              onAspect={(aspect) => {
                updateSection(section.key, {
                  teachStatus: "explored",
                  teachAspect: aspect,
                  loopStep: "probe",
                });
                log("teach_aspect_picked");
              }}
              onSkipKnown={() => {
                updateSection(section.key, { teachStatus: "skipped_known", loopStep: "probe" });
                log("teach_skipped_known");
              }}
            />
          ) : null}

          {inStance && section.mode === "memory" && section.loopStep === "teach" ? (
            <MemoryMirror
              question={mirrorQuestion(lesson.emotionalTerms, session.assignmentText)}
              value={idea}
              onChange={(value) => {
                paste.onChange(idea, value);
                setIdea(value);
              }}
              onPaste={paste.onPaste}
              onDrop={paste.onDrop}
              onSave={() => {
                void (async () => {
                const mirrorProbe = probeForThinNote(idea);
                if (mirrorProbe) {
                  setThinNote(mirrorProbe);
                  return;
                }
                setThinNote(null);
                const nextIdeas = [...keptIdeas(section.ideas), idea];
                const nextSession: Session = {
                  ...session,
                  sections: session.sections.map((item) =>
                    item.key === section.key ? { ...item, ideas: nextIdeas, loopStep: "probe" as const } : item,
                  ),
                };
                if (!(await saveLoop(nextSession, `stance:${section.key}`, idea, { stage: 2, sectionKey: section.key }))) return;
                const safety = safetyNoteFor(idea);
                const ratio = paste.meta.pastedChars + paste.meta.typedChars > 0 ? paste.meta.pasteRatio : 0;
                updateSection(
                  section.key,
                  {
                    teachStatus: "mirrored",
                    ideas: nextIdeas,
                    loopStep: "probe",
                  },
                  {
                    safetyNote: safety.show ? safety.note : "",
                    events: [...session.events, safety.show ? safety.event : "mirror_answered"],
                    answers: [
                      ...session.answers,
                      {
                        kind: "mirror",
                        text: idea,
                        pasteRatio: ratio,
                        pastedChars: paste.meta.pastedChars,
                        typedChars: paste.meta.typedChars,
                      },
                    ],
                  },
                );
                paste.reset();
                setIdea("");
                })();
              }}
            />
          ) : null}

          {inStance && section.loopStep === "probe" ? (
            <div className="space-y-3">
              <CoachSays>
                {section.mode === "memory" ? MEMORY_PROBE_OPENER : LESSON_PROBE_OPENER}
              </CoachSays>
              <Textarea
                value={idea}
                onChange={(event) => {
                  paste.onChange(idea, event.target.value);
                  setIdea(event.target.value);
                }}
                onPaste={paste.onPaste}
                onDrop={paste.onDrop}
                placeholder="Your idea, in your words"
              />
              {thinNote ? <p className="text-sm text-red-700">{thinNote}</p> : null}
              <SaveStatus status={noteStatus} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    void (async () => {
                    if (!idea.trim()) return;
                    const probe = probeForThinNote(idea);
                    if (probe) {
                      setThinNote(probe);
                      return;
                    }
                    setThinNote(null);
                    const nextIdeas = replacingClaim.current
                      ? replaceClaim(section.ideas, idea)
                      : [...keptIdeas(section.ideas), idea];
                    replacingClaim.current = false;
                    const nextSession: Session = {
                      ...session,
                      sections: session.sections.map((item) =>
                        item.key === section.key
                          ? { ...item, ideas: nextIdeas, loopStep: section.searchStatus === "not_needed" ? "summarize" : "search" }
                          : item,
                      ),
                    };
                    if (!(await saveLoop(nextSession, `stance:${section.key}`, idea, { stage: 2, sectionKey: section.key }))) return;
                    const reel =
                      section.mode === "lesson" && section.concept
                        ? highlightReelFor({ answer: idea, concept: section.concept })
                        : null;
                    const seeded = reel ? seedLeadFromHighlight(reel) : null;
                    const ratio = paste.meta.pastedChars + paste.meta.typedChars > 0 ? paste.meta.pasteRatio : 0;
                    updateSection(
                      section.key,
                      {
                        ideas: nextIdeas,
                        chosenLead: seeded?.name ?? section.chosenLead,
                        loopStep: section.searchStatus === "not_needed" ? "summarize" : "search",
                      },
                      {
                        answers: [
                          ...session.answers,
                          {
                            kind: "probe",
                            text: idea,
                            pasteRatio: ratio,
                            pastedChars: paste.meta.pastedChars,
                            typedChars: paste.meta.typedChars,
                          },
                        ],
                      },
                    );
                    paste.reset();
                    setIdea("");
                    })();
                  }}
                >
                  Save this idea
                </Button>
              </div>
              {followUp?.kind === "teach_then_ask" ? (
                <TeachCardView
                  card={followUp.card}
                  onAspect={(aspect) => {
                    updateSection(section.key, { teachAspect: aspect, teachStatus: "explored" });
                    log("teach_then_ask_shown");
                  }}
                  onSkipKnown={() => updateSection(section.key, { teachStatus: "skipped_known" })}
                />
              ) : null}
              {section.mode === "memory" ? (
                <MemoryTriggerList
                  triggers={triggersForStudent({
                    under18: false,
                    hiddenIds: session.hiddenTriggers,
                    refresh: session.triggerRefresh,
                    theme: "general",
                  })}
                  activeLine={session.activeTrigger}
                  onPick={(trigger: MemoryTrigger) => {
                    setSession({ ...session, activeTrigger: trigger.line, events: [...session.events, "memory_trigger_picked"] });
                  }}
                  onHide={(trigger) =>
                    setSession({ ...session, hiddenTriggers: [...session.hiddenTriggers, trigger.id] })
                  }
                  onSkip={() => log("memory_triggers_skipped")}
                />
              ) : null}
              {session.activeTrigger ? <p className="text-sm">{SCRIPTED_MEMORY_FOLLOW_UP}</p> : null}
              {session.safetyNote ? (
                <p className="rounded-lg bg-white p-3 text-sm text-rw-ink">{session.safetyNote}</p>
              ) : null}
            </div>
          ) : null}

          {inStance && section.loopStep === "search" && !examples?.personalized ? (
            <div className="space-y-3 rounded-xl border border-rw-ink/15 bg-white p-4">
              <p className="text-sm text-rw-ink/80">
                I couldn&apos;t tie research directions to this assignment yet. Name a source or
                example you want to check, in your own words.
              </p>
              <Textarea
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                placeholder="A source, person, or example to verify"
              />
              <Button
                type="button"
                disabled={!idea.trim()}
                onClick={() => {
                  updateSection(section.key, { chosenLead: idea.trim(), loopStep: "summarize" });
                  log("section_lead_picked");
                  setIdea("");
                }}
              >
                I&apos;ll check this
              </Button>
            </div>
          ) : null}

          {inStance && section.loopStep === "search" && batch ? (
            <LeadBatchView
              ranked={batch.ranked}
              wildcard={batch.wildcard}
              capReached={batch.capReached}
              searchPrompt={
                batch.capReached
                  ? buildGoogleSearchPrompt({
                      section: section.title,
                      rubricTerms: [section.concept ?? "assignment"],
                      storyAngle: lesson.statement,
                    })
                  : null
              }
              onPick={(lead: PreparedLead) => {
                updateSection(section.key, { chosenLead: lead.name, loopStep: "summarize" });
                log(lead.isWildcard ? "lead_wildcard_picked" : "section_lead_picked");
              }}
            />
          ) : null}

          {inStance && (section.loopStep === "summarize" || section.loopStep === "confirm") ? (
            <ConfirmPanel
              section={section}
              memory={section.mode === "memory"}
              onConfirm={(notes) => {
                const raw = logicCheckFromNotes({
                  notes,
                  assignmentText: session.assignmentText,
                  rubricRef: section.rubricRef,
                  mode: section.mode,
                  confirmedPrompt,
                  confirmedTopic,
                });
                const logic = finalizeLogicCheck(raw, {
                  assignmentText: session.assignmentText,
                  studentNotes: notes,
                  mode: section.mode,
                  rubricRequiresCounterargument: false,
                  validRubricRefs: [section.rubricRef, "ethics", "prompt"],
                });
                updateSection(section.key, {
                  loopStep: "logic_check",
                  logic,
                  logicRevealed: false,
                  ideas: notes.trim() ? [notes.trim()] : [],
                });
                log("logic_opener_shown");
              }}
            />
          ) : null}

          {inStance && section.loopStep === "logic_check" && section.logic && !section.logicRevealed ? (
            <LogicCheckpoint
              phase="opener"
              onChoice={(choice) => {
                if (choice === "tweak") {
                  updateSection(section.key, { loopStep: "probe", logicRevealed: false });
                  setIdea(keptIdeas(section.ideas).at(-1) ?? "");
                  log("logic_opener_tweak");
                  return;
                }
                if (choice === "yes") {
                  const passed = section.logic?.result.tier === "pass";
                  updateSection(section.key, {
                    logicRevealed: true,
                    ...(passed ? { status: "confirmed" as const } : {}),
                  });
                }
                log("logic_check_run");
              }}
              onContinue={() => undefined}
            />
          ) : null}

          {inStance && section.loopStep === "logic_check" && section.logic && section.logicRevealed ? (
            <LogicCheckpoint
              phase={section.logic.result.tier}
              reason={section.logic.result.reason}
              claimQuote={section.logic.result.studentClaimRef?.quote}
              assignmentQuote={section.logic.result.citedTerm?.quote}
              questions={section.logic.result.alternativeAngles.map((angle) => angle.question)}
              onChoice={(choice) => {
                if (choice === "continued") {
                  continueAfterLogic("continued");
                  return;
                }
                if (choice === "keep") {
                  void continueAfterLogic("keep");
                  return;
                }
                if (choice === "tweak") {
                  updateSection(section.key, { loopStep: "probe" });
                  log("logic_opener_tweak");
                  router.push(`/app/papers/${paperId}/stage/2`);
                  return;
                }
                if (choice === "adjust" || choice === "revise" || choice === "reframe" || choice === "new_angle") {
                  replacingClaim.current = true;
                  setIdea(revisionPrefill(section.ideas));
                  updateSection(section.key, { loopStep: "probe", logicRevealed: false, logic: null });
                  log("logic_check_revise");
                }
              }}
              onContinue={() => continueAfterLogic("pass")}
            />
          ) : null}

          {inStance && section.status !== "confirmed" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                updateSection(section.key, { status: "skipped" });
                log("section_skipped");
                setActive(Math.min(session.sections.length - 1, active + 1));
              }}
            >
              Skip this section for now
            </Button>
          ) : null}
        </div>
      ) : null}

      {stage === 3 &&
      productStageBounce({ stage, progress: stageProgress, sections: session.sections }) === "stay" ? (
        <ProductNotes
          title="Outline"
          intro="Pau Pau pulled in your notes from Stance. Shape each section into a short outline in your own words: one line per point, your main claim first, then the example that shows it."
          sections={session.sections}
          editable
          paperId={paperId}
          persist={persist}
          onEdit={(key, text) => {
            outlineDrafts.current[key] = text;
            // A cleared box is not a decision to delete the Stance notes.
            if (text.trim()) updateSection(key, { ideas: [text.trim()] });
          }}
          onContinue={() => {
            void (async () => {
              const sections = session.sections.map((item) => {
                const text = outlineDrafts.current[item.key]?.trim();
                // Blank or untouched drafts keep the student's kept Stance ideas.
                if (!text || text === keptIdeas(item.ideas).join("\n")) return item;
                return { ...item, ideas: [text] };
              });
              const nextSession = { ...session, sections };
              commit(nextSession);
              if (persist) {
                for (const item of sections) {
                  const outlineText = keptIdeas(item.ideas).join("\n");
                  if (!outlineText.trim()) continue;
                  const ok = await persistField(paperId, {
                    fieldKey: `outline:${item.key}`,
                    text: outlineText,
                    submitted: true,
                    resume: { stage: 3, sectionKey: item.key, screen: "outline" },
                    session: nextSession,
                  });
                  if (!ok) {
                    setThinNote("Couldn't save the outline.");
                    return;
                  }
                }
              }
              await continueProductStage();
            })();
          }}
        />
      ) : null}

      {stage === 4 &&
      productStageBounce({ stage, progress: stageProgress, sections: session.sections }) === "stay" &&
      section?.loopStep !== "logic_check" ? (
        <ProductNotes
          title="Sources"
          intro="Directions to verify yourself. The app does not write the citations or the sentences."
          direction={sourceSearchDirections(
            subject,
            session.sections.map((item) => keptIdeas(item.ideas).join(" ")).join(" "),
          )}
          sections={session.sections}
          showLeads
          onContinue={continueProductStage}
        />
      ) : null}

      {stage === 5 && FEATURES.draftingMuscle && !locks ? (
        <DraftingStage
          persist={persist}
          paperId={paperId}
          promptType={session.extraction.promptType}
          storyAngle={
            draftingAnchors({
              introNote: keptIdeas(session.sections.find((item) => item.kind === "intro")?.ideas ?? [])[0],
              storyAnswer,
            }).story
          }
          thesis={
            draftingAnchors({
              introNote: keptIdeas(session.sections.find((item) => item.kind === "intro")?.ideas ?? [])[0],
              storyAnswer,
            }).mainPoint
          }
          lessonConcept={lesson.concepts[0]?.term ?? null}
          savedBeat={savedBeat}
          sections={session.sections.map((item) => ({
            key: item.key,
            title: item.title,
            kind: item.kind,
            mode: item.mode,
            ideas: item.ideas,
            chosenLead: item.chosenLead,
            teachAspect: item.teachAspect,
          }))}
        />
      ) : null}

      {stage === 5 && (!FEATURES.draftingMuscle || locks) ? (
        <StageFive
          locked={locks}
          skipped={skipped.map((item) => item.title)}
          sections={session.sections}
          onJump={(title) => {
            const index = session.sections.findIndex((item) => item.title === title);
            if (index >= 0) {
              setActive(index);
              router.push(`/app/papers/${paperId}/stage/2`);
            }
          }}
        />
      ) : null}
      {stage === 5 && !FEATURES.draftingMuscle && !locks ? (
        <Button type="button" className="mt-4" onClick={continueProductStage}>
          Continue
        </Button>
      ) : null}

      {stage === 6 ? (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-2xl text-rw-ink">Revise</h2>
          {FEATURES.draftingMuscle ? (
            <div className="rounded-xl bg-white p-4 text-sm">
              <p className="font-medium">Look again at your introduction.</p>
              <p className="mt-2">Does your intro promise what your body paragraphs deliver?</p>
              <p>Is your main point in the intro still the point you ended on?</p>
              <p>Is there a term your intro uses that your body defines differently?</p>
            </div>
          ) : null}
          <Textarea
            value={session.draft}
            onChange={(event) => setSession({ ...session, draft: event.target.value })}
            placeholder="Your draft stays in your words."
          />
          <p className="text-sm text-rw-ink/60">{wordCount(session.draft)} words</p>
          {mismatch?.triggered && !session.nudgeKept ? (
            <VoiceNudge
              result={mismatch}
              section={section?.title ?? "draft"}
              part={session.draft}
              onRework={() => {
                setSession({ ...session, nudgeRework: true, events: [...session.events, VOICE_NUDGE_EVENTS.reworkOpened] });
              }}
              onKeep={() => {
                setSession({ ...session, nudgeKept: true, events: [...session.events, VOICE_NUDGE_EVENTS.kept] });
              }}
            />
          ) : null}
          <p className="text-sm text-rw-ink/70">
            Sounds like you:{" "}
            {checklistItem5Resolved({
              triggered: Boolean(mismatch?.triggered),
              kept: session.nudgeKept,
              revisionSavedAfterRework: session.nudgeRework,
            })
              ? "resolved for this part"
              : "still open"}
          </p>
          <VoiceNote note={voice.note} />
        </section>
      ) : null}

      {skipped.length > 0 && stage <= 5 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-rw-ink/10 bg-white px-4 py-3 text-sm">
          {skipped.map((item) => (
            <p key={item.key}>
              You skipped {item.title}. It needs to be finished before you start your draft.{" "}
              <button
                type="button"
                className="font-semibold text-rw-teal"
                onClick={() => {
                  setActive(session.sections.findIndex((sectionItem) => sectionItem.key === item.key));
                  log("section_skip_reminder_clicked");
                  router.push(`/app/papers/${paperId}/stage/2`);
                }}
              >
                Go back to {item.title}
              </button>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Only shown when no Stage 1 assignment text exists for this paper. */
function AssignmentSeed({ paperId, onUse }: { paperId: string; onUse: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl text-rw-ink">Your assignment</h1>
      <p className="mt-2 text-sm text-rw-ink/70">
        We couldn&apos;t find the assignment text from Stage 1. Paste it here and coaching starts
        from that text, or{" "}
        <a href={`/app/papers/${paperId}/stage/1`} className="font-semibold text-rw-teal">
          go back to Stage 1
        </a>
        .
      </p>
      <Textarea className="mt-4" value={text} onChange={(event) => setText(event.target.value)} />
      <Button type="button" className="mt-4" disabled={!text.trim()} onClick={() => onUse(text.trim())}>
        Use this assignment
      </Button>
    </div>
  );
}

function MemoryMirror({
  question,
  value,
  onChange,
  onPaste,
  onDrop,
  onSave,
}: {
  question: string;
  value: string;
  onChange: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop: (event: DragEvent<HTMLTextAreaElement>) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="font-medium text-rw-ink">{question}</p>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} onPaste={onPaste} onDrop={onDrop} />
      <Button type="button" onClick={onSave} disabled={!value.trim()}>
        Save what it means to you
      </Button>
    </div>
  );
}

function ConfirmPanel({
  section,
  memory,
  onConfirm,
}: {
  section: RuntimeSection;
  memory: boolean;
  onConfirm: (notes: string) => void;
}) {
  const notes = keptIdeas(section.ideas).at(-1) ?? "";
  return (
    <div className="rounded-xl border border-rw-ink/15 bg-white p-4">
      <CoachSays>
        {memory
          ? MEMORY_CONFIRM
          : `Are you comfortable moving forward with ${section.chosenLead ?? "your lead"} and ${section.teachAspect ?? section.concept ?? "this angle"}?`}
      </CoachSays>
      {section.concept ? <p className="mt-2 text-sm">Lesson link: {lessonLinkFor(section.concept)}</p> : null}
      <Button type="button" className="mt-3" onClick={() => onConfirm(notes)}>
        Yes, lock it in
      </Button>
    </div>
  );
}

function OutlineDraft({
  paperId,
  sectionKey,
  label,
  value,
  enabled,
  onChange,
}: {
  paperId: string;
  sectionKey: string;
  label: string;
  value: string;
  enabled: boolean;
  onChange: (text: string) => void;
}) {
  // Keep the raw text the student typed. The parent stores a trimmed, filtered
  // note, and feeding that back on every keystroke ate spaces ("later.EDIT").
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value.trim() && value.trim() !== text.trim()) setText(value);
  }
  const status = useDraftSave({
    paperId,
    fieldKey: `outline:${sectionKey}`,
    text,
    enabled,
    resume: draftPointer({ stage: 3, sectionKey }),
  });
  return (
    <>
      <Textarea
        className={`mt-3 w-full ${dsTextarea}`}
        aria-label={`Outline notes for ${label}`}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(event.target.value);
        }}
      />
      <SaveStatus status={status} />
    </>
  );
}

function ProductNotes({
  title,
  intro,
  direction,
  sections,
  showLeads = false,
  editable = false,
  paperId,
  persist = false,
  onEdit,
  onContinue,
}: {
  title: string;
  intro: string;
  direction?: string;
  sections: RuntimeSection[];
  showLeads?: boolean;
  editable?: boolean;
  paperId?: string;
  persist?: boolean;
  onEdit?: (key: string, text: string) => void;
  onContinue: () => void;
}) {
  return (
    <section className="mt-2 space-y-4">
      <h1 className={dsH1}>{title}</h1>
      <p className={dsBody}>{intro}</p>
      {direction ? <p className="text-[16px] leading-[1.6] text-ds-ink">{direction}</p> : null}
      {sections.map((item) => (
        <article key={item.key} className={`${dsCard} p-6`}>
          <h2 className={dsLabel}>{item.title}</h2>
          <p className={`mt-1 ${dsCaption}`}>{item.needs}</p>
          {editable ? (
            <OutlineDraft
              paperId={paperId ?? ""}
              sectionKey={item.key}
              label={item.title}
              value={keptIdeas(item.ideas).join("\n")}
              enabled={Boolean(persist && paperId)}
              onChange={(text) => onEdit?.(item.key, text)}
            />
          ) : (
            keptIdeas(item.ideas).map((note) => (
              <p key={note} className="mt-2 text-[16px] leading-[1.6] text-ds-ink">Your note: {note}</p>
            ))
          )}
          {showLeads && visibleSourceLead(item.chosenLead) ? (
            <p className={`mt-2 ${dsBody}`}>To verify: {visibleSourceLead(item.chosenLead)}</p>
          ) : null}
        </article>
      ))}
      <DsButton onClick={onContinue}>Continue</DsButton>
    </section>
  );
}

function StageFive({
  locked,
  skipped,
  sections,
  onJump,
}: {
  locked: boolean;
  skipped: string[];
  sections: RuntimeSection[];
  onJump: (title: string) => void;
}) {
  if (locked) {
    return (
      <div className="mt-8 rounded-xl bg-white p-4">
        <h2 className="font-display text-2xl">Drafting locked</h2>
        <p className="mt-2 text-sm text-rw-ink/75">
          Finish or skip every section before the draft opens. Skipped sections still need to be finished.
        </p>
        {skipped.map((title) => (
          <button key={title} type="button" className="mt-2 block text-sm font-semibold text-rw-teal" onClick={() => onJump(title)}>
            Go back to {title}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-8 space-y-3">
      <h2 className="font-display text-2xl">Write in your words</h2>
      {sections.map((section) => (
        <article key={section.key} className="rounded-xl bg-white p-4 text-sm">
          <h3 className="font-medium">{section.title}</h3>
          {section.concept ? <p>You&apos;re showing {section.concept}.</p> : null}
          {section.ideas.map((item) => (
            <p key={item}>Idea: {item}</p>
          ))}
          <p className="mt-2 text-rw-ink/70">Write those ideas in your own words.</p>
        </article>
      ))}
    </div>
  );
}
