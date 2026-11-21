"use client";

import { useEffect, useMemo, useState, type ClipboardEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LeadBatchView } from "@/components/coaching/lead-batch";
import { LogicCheckpoint } from "@/components/coaching/logic-checkpoint";
import { MemoryTriggerList } from "@/components/coaching/memory-triggers";
import { TeachCardView } from "@/components/coaching/teach-card";
import { VoiceNote } from "@/components/coaching/voice-note";
import { VoiceNudge } from "@/components/coaching/voice-nudge";
import {
  assembleLeadBatch,
  buildGoogleSearchPrompt,
  type LeadCandidate,
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

function leadIdeas(concept: string): { candidates: LeadCandidate[]; wildcard: LeadCandidate } {
  const label = concept || "the concept";
  return {
    candidates: [
      {
        name: "A source your field usually cites",
        rubricMatch: 0.91,
        rubricRef: "lesson_concept",
        lessonLink: lessonLinkFor(label),
        whyFits: `Often used when a class studies ${label}. Verify it before you cite it.`,
      },
      {
        name: "A second example from the same field",
        rubricMatch: 0.78,
        rubricRef: "lesson_concept",
        lessonLink: lessonLinkFor(label),
        whyFits: `Another name readers expect for ${label}. Verify it before you cite it.`,
        interestSteered: true,
      },
      {
        name: "A case your rubric can score",
        rubricMatch: 0.7,
        rubricRef: "lesson_concept",
        lessonLink: lessonLinkFor(label),
        whyFits: "Fits the required theme. Verify the details yourself.",
      },
    ],
    wildcard: {
      name: "A school jazz band director",
      rubricMatch: 0.22,
      rubricRef: "lesson_concept",
      lessonLink: lessonLinkFor(label),
      whyFits: "Same pattern, different field.",
      isWildcard: true,
      wildcardWhy: `Music is another place the pattern of ${label} can show up.`,
      familyFriendly: true,
      controversyNote: null,
    },
  };
}

export function CoachingLoop({ paperId, stage, assignmentPrompt }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [idea, setIdea] = useState("");
  const [active, setActive] = useState(0);
  const paste = usePasteMeta();

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey(paperId));
    if (saved) {
      const parsed = JSON.parse(saved) as Session;
      setSession(parsed);
      setActive(parsed.activeIndex ?? 0);
      return;
    }
    const text = assignmentPrompt?.trim() || "";
    setSession(text ? freshSession(text) : null);
  }, [paperId, assignmentPrompt]);

  useEffect(() => {
    if (!session) return;
    window.localStorage.setItem(storageKey(paperId), JSON.stringify(session));
  }, [paperId, session]);

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
    return (
      <AssignmentSeed
        onUse={(text) => {
          setSession(freshSession(text));
          setActive(0);
        }}
      />
    );
  }

  const lesson = session.extraction.lesson;
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

  const card =
    section?.mode === "lesson" && section.concept
      ? defaultTeachCard(section.concept, section.rubricRef)
      : null;
  const followUp = section?.mode === "lesson" && idea.trim() ? teachThenAsk(idea) : null;
  const batch =
    section && section.mode === "lesson"
      ? assembleLeadBatch({
          ...leadIdeas(section.concept ?? "the concept"),
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
      <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
        What you&apos;re learning
      </p>
      <h1 className="mt-2 font-display text-3xl text-rw-ink">{lesson.statement}</h1>
      <p className="mt-2 text-sm text-rw-ink/70">
        {session.extraction.promptType === "personal_experience"
          ? "This looks like a personal-story assignment. We'll help you remember and tell it."
          : `This assignment teaches ${lesson.concepts[0]?.term ?? "the concept in your prompt"}.`}
      </p>
      <label className="mt-3 block text-sm text-rw-ink/70">
        Prompt type
        <select
          className="mt-1 block rounded-md border border-rw-ink/20 bg-white px-2 py-1"
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

      {section ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-rw-ink/70">{section.needs}</p>
          {stage === 2 && section.mode === "lesson" && section.loopStep === "teach" && card ? (
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

          {stage === 2 && section.mode === "memory" && section.loopStep === "teach" ? (
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
                const safety = safetyNoteFor(idea);
                const ratio = paste.meta.pastedChars + paste.meta.typedChars > 0 ? paste.meta.pasteRatio : 0;
                updateSection(
                  section.key,
                  {
                    teachStatus: "mirrored",
                    ideas: [...section.ideas, idea],
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
              }}
            />
          ) : null}

          {stage === 2 && section.loopStep === "probe" ? (
            <div className="space-y-3">
              <p className="font-medium text-rw-ink">
                {section.mode === "memory" ? MEMORY_PROBE_OPENER : LESSON_PROBE_OPENER}
              </p>
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (!idea.trim()) return;
                    const reel =
                      section.mode === "lesson" && section.concept
                        ? highlightReelFor({ answer: idea, concept: section.concept })
                        : null;
                    const seeded = reel ? seedLeadFromHighlight(reel) : null;
                    const ratio = paste.meta.pastedChars + paste.meta.typedChars > 0 ? paste.meta.pasteRatio : 0;
                    updateSection(
                      section.key,
                      {
                        ideas: [...section.ideas, idea],
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
                    router.push(
                      `/app/papers/${paperId}/stage/${section.searchStatus === "not_needed" ? 4 : 3}`,
                    );
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

          {stage === 3 && section.loopStep === "search" && batch ? (
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
                router.push(`/app/papers/${paperId}/stage/4`);
              }}
            />
          ) : null}

          {stage === 4 && (section.loopStep === "summarize" || section.loopStep === "confirm") ? (
            <ConfirmPanel
              section={section}
              memory={section.mode === "memory"}
              onConfirm={(notes) => {
                const raw = logicCheckFromNotes({
                  notes,
                  assignmentText: session.assignmentText,
                  rubricRef: section.rubricRef,
                  mode: section.mode,
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
                  ideas: notes ? [notes] : section.ideas,
                });
                log("logic_opener_shown");
              }}
            />
          ) : null}

          {stage === 4 && section.loopStep === "logic_check" && section.logic && !section.logicRevealed ? (
            <LogicCheckpoint
              phase="opener"
              onChoice={(choice) => {
                if (choice === "yes") {
                  const passed = section.logic?.result.tier === "pass";
                  updateSection(section.key, {
                    logicRevealed: true,
                    ...(passed ? { status: "confirmed" as const } : {}),
                  });
                }
                log(choice === "tweak" ? "logic_opener_tweak" : "logic_check_run");
              }}
              onContinue={() => undefined}
            />
          ) : null}

          {stage === 4 && section.loopStep === "logic_check" && section.logic && section.logicRevealed ? (
            <LogicCheckpoint
              phase={section.logic.result.tier}
              reason={section.logic.result.reason}
              assignmentQuote={section.logic.result.citedTerm?.quote}
              questions={section.logic.result.alternativeAngles.map((angle) => angle.question)}
              onChoice={(choice) => {
                if (choice === "continued" || choice === "keep") {
                  updateSection(section.key, {
                    status: "confirmed",
                    loopStep: "confirmed",
                    continued: choice === "continued",
                  });
                  log(choice === "continued" ? "logic_strong_continued" : "section_confirmed");
                }
              }}
              onContinue={() => {
                const next = session.sections.findIndex((item, index) => index > active && item.status !== "confirmed");
                if (next >= 0) setActive(next);
              }}
            />
          ) : null}

          {(stage === 2 || stage === 3 || stage === 4) && section.status !== "confirmed" ? (
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

      {stage === 5 ? (
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

      {stage === 6 ? (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-2xl text-rw-ink">Revise</h2>
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

function AssignmentSeed({ onUse }: { onUse: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl text-rw-ink">Confirmed assignment</h1>
      <p className="mt-2 text-sm text-rw-ink/70">
        Paste the assignment you already confirmed. Coaching starts from that text.
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
  const notes = section.ideas.join(" ");
  return (
    <div className="rounded-xl border border-rw-ink/15 bg-white p-4">
      <p className="text-sm text-rw-ink/80">
        {memory
          ? MEMORY_CONFIRM
          : `Are you comfortable moving forward with ${section.chosenLead ?? "your lead"} and ${section.teachAspect ?? section.concept ?? "this angle"}?`}
      </p>
      {section.concept ? <p className="mt-2 text-sm">Lesson link: {lessonLinkFor(section.concept)}</p> : null}
      <Button type="button" className="mt-3" onClick={() => onConfirm(notes)}>
        Yes, lock it in
      </Button>
    </div>
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
        <h2 className="font-display text-2xl">Draft locked</h2>
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
