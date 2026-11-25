"use client";

import { PauFace } from "@/components/stages/stage1/pau-presence";
import { readScoped, writeScoped } from "@/lib/local/user-scope";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Typed-send cap for the intent check; the rules answer after it (QA 8:08 PM). */
const STANCE_INTENT_CLIENT_MS = 2200;

/** Cache key for an intent check: one section, one ask, the same words. */
export function intentKey(sectionKey: string, ask: string, text: string): string {
  return `${sectionKey}|${ask.trim()}|${text.trim().replace(/\s+/g, " ")}`;
}
import { Textarea } from "@/components/ui/textarea";
import { DsButton } from "@/components/ui/ds-button";
import { clipWords } from "@/lib/copy/clip";
import { optionsAgain, stage2Earlier, stage2IntroText } from "@/lib/stages/stage2-intro";
import { isQuestionTopic } from "@/lib/copy/topic-phrase";
import { dsBody, dsCaption, dsCard, dsEyebrow, dsH1, dsLabel, dsTextarea } from "@/lib/ds/classes";
import { VoiceNote } from "@/components/coaching/voice-note";
import { VoiceNudge } from "@/components/coaching/voice-nudge";
import {
  coachingSubject,
  exampleLeadBatch,
  sourceSearchDirections,
  stageLessonHeader,
  assignmentPurposeLine,
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
  lessonKindLabel,
} from "@/lib/coaching/lesson";
import {
  finalizeLogicCheck,
  LOGIC_STRONG_HEADLINE,
  logicCheckFromNotes,
  notesOnPrompt,
  type FinalizedLogic,
} from "@/lib/coaching/logicCheck";
import { highlightReelFor, seedLeadFromHighlight } from "@/lib/coaching/highlightReel";
import { mirrorQuestion } from "@/lib/coaching/memoryPath";
import {
  safetyNoteFor,
  triggersForStudent,
  type MemoryTrigger,
} from "@/lib/coaching/memoryTriggers";
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
import { conceptTeachCard, contextTeachCard, defaultTeachCard, SOMETHING_ELSE, teachThenAsk, type TeachStatus } from "@/lib/coaching/teach";
import {
  checklistItem5Resolved,
  VOICE_NUDGE_EVENTS,
} from "@/lib/coaching/voiceNudge";
import { usePasteMeta } from "@/lib/hooks/use-paste-meta";
import { isCleanQuery } from "@/lib/coaching/searchTerm";
import { signedOut } from "@/lib/session/signedOut";
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
import { clearLocalDraft, newerDraftText, readLocalDraft } from "@/lib/papers/local-draft";
import { SaveStatus } from "@/components/stages/save-status";
import { refreshStoredLogic, revisionPrefill } from "@/lib/coaching/logicRevision";
import { keptIdeas, probeForThinNote } from "@/lib/coaching/thin";
import { wordCount } from "@/lib/utils";
import { StanceChat, type LogicChoice } from "@/components/stages/loop/stance-chat";
import { OutlineChat } from "@/components/stages/loop/outline-chat";
import type { SkeletonWords } from "@/components/stages/focus-panels";
import { useSkeleton } from "@/lib/skeleton/use-skeleton";
import { pendingSectionStorageKey, skeletonWordsFromSession, withoutSectionQuery } from "@/lib/skeleton/sections";
import { revealSection, usePublishSkeleton, useSectionRequests } from "@/lib/skeleton/live";
import {
  afterMirror,
  afterProbe,
  appendLines,
  nextOutlineIndex,
  outlineSectionsForContinue,
  stanceTurnFor,
  type LoopLine,
} from "@/lib/stages/stance-turn";
import { finalStanceIntent, intentReply, needsModel, rulesStanceIntent, type IntentTurn, type StanceIntent } from "@/lib/stages/stance-intent";
import { oneQuip } from "@/lib/coach/quips";
import { pickPhrase, pickedLeader, isLostSaying, isOptionsRequest, STAGE_PURPOSE, summaryLabel, type MaterialSummary, type PaperContext, type ReadbackPlain } from "@/lib/stage1/paper-context";
import { useStage1Past, withEarlier } from "@/components/stages/focus-panels";
import { pastLines } from "@/components/stages/loop/stance-chat";
import { assignmentQuestion } from "@/lib/copy/sentences";

/** Key points from the material, labeled by where they came from (shown under a disclosure). */
function materialList(b: { summary: MaterialSummary | null; summaries?: MaterialSummary[] } | null): { label: string; points: string[] }[] {
  const list = b?.summaries?.length ? b.summaries : b?.summary ? [b.summary] : [];
  return list.map((m) => ({ label: summaryLabel(m), points: m.points }));
}

/** The Stage 1 brief, as Stages 2-3 read it (north star D). */
type PaperBrief = {
  summary: MaterialSummary | null;
  summaries?: MaterialSummary[];
  options: PaperContext["options"] | null;
  decision: PaperContext["decision"] | null;
  leader?: PaperContext["leader"] | null;
  readback?: ReadbackPlain | null;
  missingAsk?: string | null;
};

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
  /** Stage 2 conversation, rebuilt after a reload (PLAN.md 9). */
  transcript?: LoopLine[];
  /** Stage 3: sections the student has outlined, one at a time. */
  outlineDone?: string[];
  outlineTranscript?: LoopLine[];
  /**
   * Pau's answer to a request or question ("ask me questions", "what do
   * you mean?"). It shows inside her current turn while nothing new has been
   * said (transcript length === at), so it never becomes its own bubble.
   */
  aside?: { k: string; at: number; paras: string[]; intent?: StanceIntent } | null;
  outlineAside?: { k: string; at: number; paras: string[]; intent?: StanceIntent } | null;
};

type Props = {
  paperId: string;
  stage: number;
  /** The paper's real stage (server). The URL stage never decides a gate. */
  paperStage?: number;
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


/** Scoped per user (see lib/local/user-scope). */
function storageName(paperId: string) {
  return `loop:${paperId}`;
}

/** Pre-scoping key, read once and moved. */
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

/** How long leads wait for the model search terms before the keyword fallback. */
const TERMS_WAIT_MS = 15000;

export function CoachingLoop({
  paperId,
  stage,
  paperStage,
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
  // North star D: what Stage 1 learned (read-back, material key points, decision), for Stages 2-3.
  const [pctx, setPctx] = useState<PaperBrief | null>(null);
  // PC-29 QA round 3: the Stage 2 opener (the plain-words assignment, "Earlier you picked …") waits
  // for the paper context instead of showing (and saying) the parsed-topic fallback first.
  const [pctxSettled, setPctxSettled] = useState(false);
  const [asideChips, setAsideChips] = useState<string[]>([]);
  useEffect(() => {
    if (!persist || stage < 2 || stage > 3) return;
    let live = true;
    const cap = setTimeout(() => live && setPctxSettled(true), 5_000);
    void fetch(`/api/papers/${paperId}/intake/brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "context" }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<PaperBrief & { ok?: boolean }>) : null))
      .then((d) => {
        if (live && d?.ok) setPctx(d);
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(cap);
        if (live) setPctxSettled(true);
      });
    return () => {
      live = false;
      clearTimeout(cap);
    };
  }, [paperId, persist, stage]);
  const introReady = !persist || pctxSettled;
  // PC-28: the skeleton (ghost paper #1 shape, ghost #2 body titles) plus the student's own words.
  const skelSections = session?.sections ?? [];
  const skelWords: SkeletonWords = skeletonWordsFromSession(skelSections, session?.outlineDone ?? [], keptIdeas);
  const skeletonView = useSkeleton(paperId, {
    enabled: stage >= 2 && stage <= 3,
    fallbackText: session?.assignmentText ?? "",
    refreshKey: skelSections.map((item) => `${item.key}:${item.status}:${item.ideas.length}`).join("|"),
    outline:
      persist && skelWords.body?.locked
        ? { choices: [pctx?.decision?.answer ?? "", pctx?.leader?.answer ?? ""].filter(Boolean), bodyNotes: skelWords.body.notes }
        : null,
  });
  const skeleton = { view: skeletonView, words: skelWords, direction: pctx?.decision?.answer ?? null };
  // PC-30: The Skeleton (one per page, outside the chat) shows exactly this.
  usePublishSkeleton(
    paperId,
    sessionLoaded
      ? { view: skeletonView, words: skelWords, direction: skeleton.direction, sessionKeys: skelSections.map((item) => item.key), waiting: skeletonView ? null : "Building your skeleton…" }
      : null,
  );
  // QA 1:11 AM #6/#8: Past chat reaches back to Stage 1 (and Stage 2 from Stage 3).
  const stage1Past = useStage1Past(paperId, persist);
  const stage2Past = withEarlier(stage1Past, pastLines(session?.transcript ?? [], session?.sections ?? []), "Stage 2 · Stance");
  const [idea, setIdea] = useState("");
  // Clear only the text that was sent: words typed while a reply was loading
  // stay in the box (QA 12:25 #4: a send was silently lost).
  const clearSent = (sent: string) => setIdea((cur) => (cur.trim() === sent.trim() ? "" : cur));
  // The box empties on send; a note that wasn't saved goes back unless they typed something new.
  const restore = (sent: string) => setIdea((cur) => (cur.trim() ? cur : sent));
  const replacingClaim = useRef(false);
  const outlineDrafts = useRef<Record<string, string>>({});
  // A thin-note hint belongs to the turn it was shown on (QA 10:38 #6).
  const [thinState, setThinState] = useState<{ text: string; turn: string } | null>(null);
  const [active, setActive] = useState(0);
  const [moving, setMoving] = useState(false);
  const [outlineSaving, setOutlineSaving] = useState(false);
  // Server copies of each section's unsent Stage 2 note, from the last load.
  const unsentDrafts = useRef<Record<string, { text: string; updatedAt: string | null }>>({});
  const unsentFor = (sectionKey: string | null | undefined): string => {
    const draftKey = stanceDraftKey(sectionKey);
    return draftKey ? newerDraftText(readLocalDraft(paperId, draftKey), unsentDrafts.current[draftKey] ?? null) : "";
  };
  const noteStatus = useDraftSave({
    paperId,
    fieldKey: stanceDraftKey(session?.sections[active]?.key) ?? "stance:note:draft",
    text: idea,
    enabled: persist && stage === 2 && Boolean(session),
    localCopy: true,
    resume: draftPointer({ stage: 2, sectionKey: session?.sections[active]?.key ?? null }),
  });
  // Moving to another section brings back that section's unsent note (if the box is empty).
  const activeKey = session?.sections[active]?.key ?? null;
  useEffect(() => {
    if (stage !== 2 || !sessionLoaded || !activeKey) return;
    const unsent = unsentFor(activeKey);
    if (unsent.trim()) setIdea((cur) => (cur.trim() ? cur : unsent));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per section, not per keystroke
  }, [stage, sessionLoaded, activeKey, paperId]);
  const paste = usePasteMeta();
  // The shell passes a fresh stageProgress array on every render. Read it from
  // a ref so a parent re-render does not reload the saved session over the
  // student's live progress (it reset Stance to the first section's leads).
  const relevance = useRef<{ key: string; verdict: Promise<boolean | null> } | null>(null);
  const [checkingLogic, setCheckingLogic] = useState(false);
  const [answering, setAnswering] = useState(false);
  const syncChain = useRef<Promise<unknown>>(Promise.resolve());
  /** Intent checks by section|ask|text; a pause in typing starts one, the send reuses it. */
  const intentCache = useRef(new Map<string, Promise<StanceIntent>>());
  const stageProgressRef = useRef(stageProgress);
  useEffect(() => {
    stageProgressRef.current = stageProgress;
  }, [stageProgress]);
  // PC-30: a section picked in The Skeleton. From another page it arrives as ?section=key (read
  // once, then dropped from the URL); on this page as a request. Stage 2 opens that section (the
  // same as the section buttons); both stages then scroll to it and put the cursor in the box.
  const skeletonAsk = useRef<string | null>(null);
  // Clear ?section as soon as it appears (including a Stage 2 → 3 jump). Persist the key in
  // sessionStorage so a remount after the URL is already clean still opens that section.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storeKey = pendingSectionStorageKey(paperId);
    const fromUrl = new URLSearchParams(window.location.search).get("section");
    const key = fromUrl || skeletonAsk.current || sessionStorage.getItem(storeKey);
    if (!key) return;
    skeletonAsk.current = key;
    sessionStorage.setItem(storeKey, key);
    if (fromUrl) window.history.replaceState(window.history.state, "", withoutSectionQuery(window.location.href));
  }, [stage, paperId]);
  useEffect(() => {
    if (!sessionLoaded) return;
    const storeKey = pendingSectionStorageKey(paperId);
    const key = skeletonAsk.current || (typeof window !== "undefined" ? sessionStorage.getItem(storeKey) : null);
    if (!key) return;
    skeletonAsk.current = null;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(storeKey);
      if (new URLSearchParams(window.location.search).has("section")) {
        window.history.replaceState(window.history.state, "", withoutSectionQuery(window.location.href));
      }
    }
    revealSection(stage, key);
  }, [sessionLoaded, stage, paperId]);
  useSectionRequests(stage, (req) => {
    if (!session || stage !== 2) return;
    const index = session.sections.findIndex((item) => item.key === req.section);
    if (index < 0 || index === active) return;
    setActive(index);
    commit({ ...session, activeIndex: index });
  });

  useEffect(() => {
    let cancelled = false;
    const savedRaw = readScoped(storageName(paperId), storageKey(paperId));
    const saved = savedRaw ? (JSON.parse(savedRaw) as Session) : null;
    const finish = (
      base: Session | null,
      drafts: { fieldKey: string; text: string; updatedAt?: string | null }[],
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
        // The paper's own stage, never the URL's: opening /stage/N must not confirm sections.
        currentStage: Math.min(stage, paperStage ?? stage),
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
      // Stage 2: unsent notes come back in the box, per paper, section and
      // device (the newer of this browser's copy and the server's), never over
      // anything typed already (QA 6:53 PM #1). The server copies are kept so
      // switching sections restores each one.
      unsentDrafts.current = {};
      for (const d of drafts) if (/^stance:.+:draft$/.test(d.fieldKey)) unsentDrafts.current[d.fieldKey] = { text: d.text, updatedAt: d.updatedAt ?? null };
      // PC-30: The Skeleton sent them here for one section (?section=key): that one opens.
      const asked = skeletonAsk.current ?? (typeof window !== "undefined" ? sessionStorage.getItem(pendingSectionStorageKey(paperId)) : null);
      if (asked && !skeletonAsk.current) skeletonAsk.current = asked;
      if (asked && stage === 2 && base.sections.some((item) => item.key === asked)) sectionKey = asked;
      let index = sectionKey ? base.sections.findIndex((item) => item.key === sectionKey) : base.activeIndex ?? 0;
      // The resume pointer belongs to another stage (e.g. Stage 3 after a trip
      // there): open the section the student left an unsent note in.
      if (stage === 2 && resume?.stage !== 2 && !(asked && sectionKey === asked)) {
        const waiting = unsentSection(base.sections.map((item) => item.key), (key) => unsentFor(key));
        if (waiting >= 0) index = waiting;
      }
      setActive(index >= 0 ? index : 0);
      const unsent = stage === 2 ? unsentFor(base.sections[index >= 0 ? index : 0]?.key) : "";
      if (unsent.trim()) setIdea((cur) => (cur.trim() ? cur : unsent));
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
    writeScoped(storageName(paperId), JSON.stringify(session));
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
  const turnKey =
    stage === 2 && section
      ? `${section.key}:${section.loopStep}:${section.logicRevealed ? 1 : 0}:${section.status}`
      : `stage${stage}:${(session?.outlineDone ?? []).length}`;
  const thinNote = thinState && thinState.turn === turnKey ? thinState.text : null;
  function setThinNote(text: string | null) {
    setThinState(text ? { text, turn: turnKey } : null);
  }
  const totals = useMemo(
    () => summarizeCountedAnswers(session?.answers ?? []),
    [session?.answers],
  );
  // A natural library query per section from the model (QA 2:31 #3c), fetched
  // for ALL sections in one call as soon as Stage 2 loads and cached per paper
  // (QA 3:35 C), so the leads show their final terms with no visible swap. The
  // keyword builder fills in only if the model can't answer in time.
  // QA 3:26 AM #1: the assignment's real question for every prompt check (never a stored sources line).
  const realQuestion = assignmentQuestion({ prompt: confirmedPrompt, raw: session?.assignmentText ?? "", topic: confirmedTopic });
  const termTopic = realQuestion || confirmedTopic?.trim() || "";
  const termSections = useMemo(
    () => (session?.sections ?? []).map((s) => ({ key: s.key, title: s.title, needs: s.needs })),
    [session?.sections],
  );
  const termCacheKey = termTopic && termSections.length ? `${termTopic}\u0001${termSections.map((s) => s.key).join(",")}` : "";
  const [searchTerms, setSearchTerms] = useState<{ key: string; map: Record<string, string> }>({ key: "", map: {} });
  const termsAsked = useRef("");
  // While the model's search terms are on the way (up to ~15s), leads wait
  // behind a quiet placeholder instead of showing keyword terms that swap
  // later (QA 4:42 #3). After that, the keyword fallback shows.
  const [termsWait, setTermsWait] = useState("");
  useEffect(() => {
    if (stage < 2 || !termCacheKey || termsAsked.current === termCacheKey || signedOut()) return;
    termsAsked.current = termCacheKey;
    const cacheName = `searchTerms:${paperId}`;
    try {
      const cached = JSON.parse(readScoped(cacheName) ?? "null") as { key?: string; map?: Record<string, string> } | null;
      if (cached?.key === termCacheKey && cached.map && Object.keys(cached.map).length) {
        setSearchTerms({ key: termCacheKey, map: cached.map });
        return;
      }
    } catch {
      /* ignore a bad cache */
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    setTermsWait(termCacheKey);
    const giveUp = setTimeout(() => setTermsWait((k) => (k === termCacheKey ? "" : k)), TERMS_WAIT_MS);
    void fetch(`/api/papers/${paperId}/stance/search-term`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: termTopic.slice(0, 500), sections: termSections.slice(0, 12) }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ queries?: Record<string, unknown> }>) : null))
      .then((data) => {
        const map: Record<string, string> = {};
        for (const [k, v] of Object.entries(data?.queries ?? {})) if (typeof v === "string" && isCleanQuery(v)) map[k] = v;
        if (!Object.keys(map).length) return;
        setSearchTerms({ key: termCacheKey, map });
        writeScoped(cacheName, JSON.stringify({ key: termCacheKey, map }));
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        clearTimeout(giveUp);
        setTermsWait((k) => (k === termCacheKey ? "" : k));
      });
  }, [stage, termCacheKey, termTopic, termSections, paperId]);
  const voice = voiceNoteForStage(stage, {
    naturalWords: totals.naturalWords,
    pastedShare: totals.pastedShare,
    hasBaseline: totals.hasBaseline,
  });

  if (!session) {
    if (!sessionLoaded) {
      return (
        <p className="text-sm text-rw-ink/70" role="status">
          Pau is pulling up your confirmed assignment…
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
    confirmedPrompt: realQuestion || confirmedPrompt,
    concept: lesson.concepts[0]?.term,
    assignmentText: session.assignmentText,
  });
  const locks = stage5Locked(session.sections);
  const skipped = session.sections.filter((item) => item.status === "skipped");

  function commit(next: Session) {
    writeScoped(storageName(paperId), JSON.stringify(next));
    setSession(next);
  }

  // Taps in Stance (teach pick, lead pick, lock-in, logic check) used to live only
  // on this device, so a reload fell back to the last typed note. Each one now
  // saves the session too, in order, so the server copy is never older.
  function syncSession(next: Session, sectionKey: string) {
    if (!persist || stage !== 2) return;
    syncChain.current = syncChain.current.then(() =>
      persistField(paperId, {
        fieldKey: "stance:step",
        text: sectionKey,
        resume: { stage: 2, sectionKey, screen: "stance" },
        session: next,
      }),
    );
  }

  function updateSection(key: string, patch: Partial<RuntimeSection>, extra?: Partial<Session>) {
    if (!session) return;
    const next: Session = {
      ...session,
      ...extra,
      sections: session.sections.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    };
    commit(next);
    syncSession(next, key);
  }

  function log(event: string) {
    const raw = readScoped(storageName(paperId), storageKey(paperId));
    const current = raw ? (JSON.parse(raw) as Session) : session;
    if (!current) return;
    commit({ ...current, events: [...current.events, event] });
  }

  async function saveLoop(next: Session, fieldKey: string, text: string, resume: { stage: number; sectionKey?: string }) {
    if (!persist) return true;
    await syncChain.current;
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

  async function continueAfterLogic(choice: "pass" | "keep" | "continued", more: LoopLine[] = []) {
    if (!session || !section) return;
    let transcript = appendLines(session.transcript, more);
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
    // "Continue anyway" after a flag: a short acknowledgement in her next turn.
    const ack =
      choice === "continued" && target.kind === "section"
        ? `Okay, we'll keep going. I flagged your ${section.title.toLowerCase()} so you can come back to it before you draft.`
        : null;
    if (ack) transcript = appendLines(transcript, [{ k: sections[nextIndex]!.key, who: "pau", text: ack }]);
    const aside = ack ? null : session.aside ?? null;
    commit({
      ...session,
      sections,
      transcript,
      aside,
      activeIndex: nextIndex,
      events: [
        ...session.events,
        choice === "continued" ? "logic_strong_continued" : "section_confirmed",
      ],
    });
    if (target.kind === "section") setActive(nextIndex);
    if (persist) {
      // Save on every confirm so a reload resumes at the next section.
      const savedSession = { ...session, sections, transcript, aside, activeIndex: nextIndex };
      await syncChain.current;
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


  // ── Stage 2 turns (PLAN.md 9). Same transitions as the old panels; each
  // also records the exchange so the chat rebuilds after a reload.
  const withLines = (more: LoopLine[]) => appendLines(session?.transcript, more);

  /**
   * Content, or a request/question to Pau? Model first, rules if it fails.
   * Same words + same ask reuse the check already started while typing (QA 8:08 PM).
   */
  function classifyIntent(text: string, ask: string): Promise<StanceIntent> {
    const rules = rulesStanceIntent(text);
    // Explicit help/questions already have a safe deterministic intent. Don't
    // make the student wait for a model to repeat that decision.
    if (rules !== "content" || !needsModel(text)) return Promise.resolve(rules);
    const key = intentKey(section?.key ?? "", ask, text);
    const hit = intentCache.current.get(key);
    if (hit) return hit;
    if (intentCache.current.size > 24) intentCache.current.clear();
    const run = fetchIntent(text, ask, rules);
    intentCache.current.set(key, run);
    return run;
  }

  async function fetchIntent(text: string, ask: string, rules: StanceIntent): Promise<StanceIntent> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), STANCE_INTENT_CLIENT_MS);
      const res = await fetch(`/api/papers/${paperId}/stance/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.slice(0, 4000), ask: ask.slice(0, 1000), section: section?.title ?? "" }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return rules;
      const data = (await res.json()) as { intent?: StanceIntent };
      return finalStanceIntent(data.intent ?? null, rules);
    } catch {
      return rules;
    }
  }

  /** A request or question is answered in her next turn and never saved as a note. */
  /** Her real answer (content question, "idk", a vague note), from the paper context; null = fall back. */
  async function coachAnswer(mode: "answer" | "lost" | "vague", message: string, sectionTitle: string, ask: string): Promise<string[] | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`/api/papers/${paperId}/coach/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, message: message.slice(0, 2000), stage: stage === 3 ? 3 : 2, section: sectionTitle, ask: ask.slice(0, 1000) }),
        signal: controller.signal,
      });
      // The 8 s cap covers reading the body too (a stalled body kept the buttons busy).
      if (!res.ok) {
        clearTimeout(timer);
        return null;
      }
      const d = (await res.json()) as { paras?: string[] };
      clearTimeout(timer);
      return d.paras?.length ? d.paras.map((p) => oneQuip(p)) : null;
    } catch {
      return null;
    }
  }

  /** Which answer mode a non-content message gets (QA 11/23: answer content, turn "idk" into points/options). */
  function answerModeFor(intent: StanceIntent, text: string): "answer" | "lost" | null {
    if (intent === "content_question") return "answer";
    if (intent === "request_help" || isLostSaying(text)) return "lost";
    return null;
  }

  async function onAside(intent: StanceIntent, turn: IntentTurn, more: LoopLine[], forced?: "vague") {
    if (!session || !section) return;
    const said = more.filter((l) => l.who === "you").map((l) => l.text).join(" ");
    const ask = more.find((l) => l.who === "pau")?.text ?? "";
    const mode = forced ?? answerModeFor(intent, said);
    // "just tell me some options": the Stage 1 options again, as chips (QA 6:03 AM).
    const again = isOptionsRequest(said) ? optionsAgain(pctx?.options?.options, pctx?.options?.people) : null;
    setAnswering(true);
    let answered: string[] | null = null;
    try {
      answered = again ? again.paras : mode ? await coachAnswer(mode, said, section.title, ask) : null;
    } finally {
      setAnswering(false);
    }
    setAsideChips(again ? again.chips : []);
    const paras = answered ?? intentReply(intent === "content" ? "request_help" : intent, { turn, section, text: said });
    // Never the same answer twice in a row for the same words (QA 2:08 #4).
    const prior = session.transcript ?? [];
    const tail = prior.slice(-(more.length + paras.length));
    const same =
      tail.length === more.length + paras.length &&
      [...more.filter((l) => l.who !== "pau"), ...paras.map((text) => ({ who: "pau" as const, text, k: section.key }))]
        .map((l) => `${l.who}:${l.text}`)
        .every((sig) => tail.some((l) => `${l.who}:${l.text}` === sig));
    if (same) {
      clearSent(idea);
      return;
    }
    // Append-only history: her answer is saved in the transcript (it survives
    // the next turn and a reload); the aside marker only shapes her next ask.
    const transcript = withLines([...more, ...paras.map((text): LoopLine => ({ k: section.key, who: "pau", text }))]);
    const moveToProbe = intent === "request_probe" && (turn === "teach_card" || turn === "mirror");
    const next: Session = {
      ...session,
      transcript,
      aside: { k: section.key, at: transcript.length, paras: [], intent },
      sections: moveToProbe
        ? session.sections.map((item) =>
            item.key === section.key ? { ...item, loopStep: "probe" as const, teachStatus: turn === "mirror" ? item.teachStatus : "explored" } : item,
          )
        : session.sections,
      events: [...session.events, `stance_${intent}`],
    };
    commit(next);
    syncSession(next, section.key);
    paste.reset();
    clearSent(idea);
    setThinNote(null);
  }

  /** Discussion over a waiting choice: lines join the chat, nothing is saved as the note. */
  function onDiscuss(more: LoopLine[]) {
    if (!session || !section) return;
    const next: Session = { ...session, transcript: withLines(more), events: [...session.events, "stance_discussion"] };
    commit(next);
    syncSession(next, section.key);
    paste.reset();
    clearSent(idea);
    setThinNote(null);
  }

  function onTeachAspect(aspect: string, more: LoopLine[]) {
    if (!section) return;
    updateSection(
      section.key,
      { teachStatus: "explored", teachAspect: aspect, loopStep: "probe" },
      { transcript: withLines(more) },
    );
    log("teach_aspect_picked");
  }

  function onTeachSkip(more: LoopLine[]) {
    if (!section) return;
    updateSection(section.key, { teachStatus: "skipped_known", loopStep: "probe" }, { transcript: withLines(more) });
    log("teach_skipped_known");
  }

  async function onMirrorSave(more: LoopLine[], text?: string) {
    const note = text ?? idea;
    if (!session || !section || !note.trim()) return;
    const mirrorProbe = probeForThinNote(note);
    if (mirrorProbe) {
      setThinNote(mirrorProbe);
      restore(note);
      return;
    }
    setThinNote(null);
    const step = afterMirror(section, note);
    const transcript = withLines(more);
    const nextSession: Session = {
      ...session,
      transcript,
      sections: session.sections.map((item) =>
        item.key === section.key ? { ...item, ideas: step.ideas, loopStep: step.loopStep } : item,
      ),
    };
    if (!(await saveLoop(nextSession, `stance:${section.key}`, note, { stage: 2, sectionKey: section.key }))) {
      restore(note);
      return;
    }
    const safety = safetyNoteFor(note);
    const ratio = paste.meta.pastedChars + paste.meta.typedChars > 0 ? paste.meta.pasteRatio : 0;
    updateSection(
      section.key,
      {
        teachStatus: "mirrored",
        ideas: step.ideas,
        loopStep: "probe",
      },
      {
        transcript,
        safetyNote: safety.show ? safety.note : "",
        events: [...session.events, safety.show ? safety.event : "mirror_answered"],
        answers: [
          ...session.answers,
          {
            kind: "mirror",
            text: note,
            pasteRatio: ratio,
            pastedChars: paste.meta.pastedChars,
            typedChars: paste.meta.typedChars,
          },
        ],
      },
    );
    paste.reset();
    clearSent(note);
  }

  async function onProbeSave(more: LoopLine[], opts?: { fromTeach?: boolean; replace?: boolean; text?: string; append?: boolean }) {
    // A Grok Voice note arrives as text (the box is empty): same checks and gates.
    const note = opts?.text ?? idea;
    if (!session || !section) return;
    if (!note.trim()) return;
    const probe = probeForThinNote(note);
    if (probe) {
      setThinNote(probe);
      restore(note);
      return;
    }
    setThinNote(null);
    if (opts?.replace) replacingClaim.current = true;
    // A new reply over the confirm is added to their note, never swapped in silently (QA 8:31 AM).
    if (opts?.append) replacingClaim.current = false;
    const teach: Partial<RuntimeSection> = opts?.fromTeach ? { teachStatus: "explored", teachAspect: SOMETHING_ELSE } : {};
    const probed = afterProbe(section, note, replacingClaim.current);
    // An added reply over the confirm goes back to the confirm with both notes, not to new directions.
    const step = opts?.append ? { ...probed, loopStep: "summarize" as const } : probed;
    replacingClaim.current = false;
    const transcript = withLines(more);
    const nextSession: Session = {
      ...session,
      transcript,
      sections: session.sections.map((item) =>
        item.key === section.key ? { ...item, ...teach, ideas: step.ideas, loopStep: step.loopStep } : item,
      ),
    };
    if (!(await saveLoop(nextSession, `stance:${section.key}`, note, { stage: 2, sectionKey: section.key }))) {
      restore(note);
      return;
    }
    const reel =
      section.mode === "lesson" && section.concept
        ? highlightReelFor({ answer: note, concept: section.concept })
        : null;
    const seeded = reel ? seedLeadFromHighlight(reel) : null;
    const ratio = paste.meta.pastedChars + paste.meta.typedChars > 0 ? paste.meta.pasteRatio : 0;
    updateSection(
      section.key,
      {
        ...teach,
        ideas: step.ideas,
        chosenLead: seeded?.name ?? section.chosenLead,
        loopStep: step.loopStep,
        ...(opts?.replace ? { logic: null, logicRevealed: false } : {}),
      },
      {
        transcript,
        answers: [
          ...session.answers,
          {
            kind: "probe",
            text: note,
            pasteRatio: ratio,
            pastedChars: paste.meta.pastedChars,
            typedChars: paste.meta.typedChars,
          },
        ],
      },
    );
    paste.reset();
    clearSent(note);
  }

  function onNameLead(text: string, more: LoopLine[]) {
    if (!section || !text.trim()) return;
    updateSection(section.key, { chosenLead: text.trim(), loopStep: "summarize" }, { transcript: withLines(more) });
    log("section_lead_picked");
    clearSent(idea);
  }

  function onPickLead(lead: PreparedLead, more: LoopLine[]) {
    if (!section) return;
    updateSection(section.key, { chosenLead: lead.name, loopStep: "summarize" }, { transcript: withLines(more) });
    log(lead.isWildcard ? "lead_wildcard_picked" : "section_lead_picked");
  }

  /** The model's relevance verdict for a note (null: it didn't answer, rules decide). */
  function fetchRelevance(notes: string, title: string): Promise<boolean | null> {
    const prompt = realQuestion;
    if (!prompt || !notes.trim()) return Promise.resolve(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    return fetch(`/api/papers/${paperId}/stance/relevance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes.slice(0, 4000), prompt: prompt.slice(0, 1000), section: title }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ onTopic?: boolean | null }>) : null))
      .then((data) => (typeof data?.onTopic === "boolean" ? data.onTopic : null))
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }

  function checkNotes(target: RuntimeSection, notes: string, onPrompt: boolean | null) {
    // Their own thesis: the Stage 1 decision (and leader) plus their thesis/intro notes (QA 7:11 AM).
    const thesis = [
      pctx?.decision?.answer ?? "",
      pctx?.leader?.answer && pctx.leader.answer !== pctx?.decision?.answer ? pctx.leader.answer : "",
      ...(session?.sections ?? [])
        .filter((item) => item.key !== target.key && /thesis|intro/i.test(`${item.key} ${item.title}`))
        .map((item) => keptIdeas(item.ideas).join(" ")),
    ]
      .filter(Boolean)
      .join(". ");
    const raw = logicCheckFromNotes({
      notes,
      thesis,
      assignmentText: session?.assignmentText ?? "",
      rubricRef: target.rubricRef,
      mode: target.mode,
      confirmedPrompt: realQuestion || confirmedPrompt,
      confirmedTopic,
      onPrompt,
    });
    return finalizeLogicCheck(raw, {
      assignmentText: session?.assignmentText ?? "",
      studentNotes: notes,
      mode: target.mode,
      rubricRequiresCounterargument: false,
      validRubricRefs: [target.rubricRef, "ethics", "prompt"],
    });
  }

  function onConfirm(more: LoopLine[]) {
    if (!session || !section) return;
    // Every kept note stays at lock-in; an added reply never silently replaces the thesis (QA 8:31 AM).
    const kept = keptIdeas(section.ideas);
    const notes = kept.join(" ");
    // Relevance first, on every section: ask the model now, use it at "Yes, check it".
    relevance.current = { key: `${section.key}:${notes}`, verdict: fetchRelevance(notes, section.title) };
    const logic = checkNotes(section, notes, null);
    updateSection(
      section.key,
      {
        loopStep: "logic_check",
        logic,
        logicRevealed: false,
        ideas: kept,
      },
      { transcript: withLines(more) },
    );
    log("logic_opener_shown");
  }

  async function onLogicOpener(choice: "yes" | "tweak", more: LoopLine[]) {
    if (!section) return;
    if (choice === "yes") {
      const notes = keptIdeas(section.ideas).join(" ");
      const pending = relevance.current?.key === `${section.key}:${notes}` ? relevance.current.verdict : fetchRelevance(notes, section.title);
      setCheckingLogic(true);
      // Never left busy: the check gives up after 9 s and uses the rule-based verdict (suite r16/r17).
      let verdict: boolean | null = null;
      try {
        verdict = await Promise.race([pending, new Promise<null>((r) => setTimeout(() => r(null), 9000))]);
      } finally {
        setCheckingLogic(false);
      }
      if (verdict !== null) {
        const logic = checkNotes(section, notes, verdict);
        const passed = logic.result.tier === "pass";
        updateSection(
          section.key,
          { logic, logicRevealed: true, ...(passed ? { status: "confirmed" as const } : {}) },
          { transcript: withLines(more) },
        );
        log("logic_check_run");
        return;
      }
    }
    if (choice === "tweak") {
      updateSection(section.key, { loopStep: "probe", logicRevealed: false }, { transcript: withLines(more) });
      setIdea(keptIdeas(section.ideas).at(-1) ?? "");
      log("logic_opener_tweak");
      return;
    }
    const passed = section.logic?.result.tier === "pass";
    updateSection(
      section.key,
      {
        logicRevealed: true,
        ...(passed ? { status: "confirmed" as const } : {}),
      },
      { transcript: withLines(more) },
    );
    log("logic_check_run");
  }

  function onLogicResult(choice: LogicChoice | "pass", more: LoopLine[]) {
    if (!section) return;
    if (choice === "pass") {
      void continueAfterLogic("pass", more);
      return;
    }
    if (choice === "continued") {
      void continueAfterLogic("continued", more);
      return;
    }
    if (choice === "keep") {
      void continueAfterLogic("keep", more);
      return;
    }
    if (choice === "tweak") {
      updateSection(section.key, { loopStep: "probe" }, { transcript: withLines(more) });
      log("logic_opener_tweak");
      router.push(`/app/papers/${paperId}/stage/2`);
      return;
    }
    if (choice === "adjust" || choice === "revise" || choice === "reframe" || choice === "new_angle") {
      replacingClaim.current = true;
      setIdea(revisionPrefill(section.ideas));
      updateSection(section.key, { loopStep: "probe", logicRevealed: false, logic: null }, { transcript: withLines(more) });
      log("logic_check_revise");
    }
  }

  function onSkipSection(more: LoopLine[]) {
    if (!session || !section) return;
    updateSection(section.key, { status: "skipped" }, { transcript: withLines(more) });
    log("section_skipped");
    setActive(Math.min(session.sections.length - 1, active + 1));
  }

  function onPromptType(promptType: PromptType) {
    if (!session) return;
    const extraction = extractLesson(session.assignmentText, { studentPromptType: promptType });
    commit({
      ...session,
      extraction: { ...extraction, promptType, source: "ai" },
      sections: buildSections({ ...extraction, promptType }),
      events: [...session.events, "prompt_type_changed"],
      activeIndex: 0,
    });
    setActive(0);
  }

  // ── Stage 3: one section at a time. The final step is the old Continue.
  async function finishOutline(base: Session) {
    const sections = outlineSectionsForContinue(base.sections, outlineDrafts.current);
    const nextSession = { ...base, sections };
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
  }

  async function onOutlineSend(key: string, text: string, more: LoopLine[]) {
    if (!session) return;
    setThinNote(null);
    outlineDrafts.current[key] = text;
    // A blank answer is not a decision to delete the Stance notes.
    const sections = text.trim()
      ? session.sections.map((item) => (item.key === key ? { ...item, ideas: [text.trim()] } : item))
      : session.sections;
    const outlineDone = [...(session.outlineDone ?? []).filter((k) => k !== key), key];
    const next: Session = {
      ...session,
      sections,
      outlineDone,
      outlineTranscript: appendLines(session.outlineTranscript, more),
    };
    commit(next);
    const nextIndex = nextOutlineIndex(sections, outlineDone);
    const saved = sections.find((item) => item.key === key);
    const outlineText = saved ? keptIdeas(saved.ideas).join("\n") : "";
    if (persist && outlineText.trim()) {
      setOutlineSaving(true);
      const ok = await persistField(paperId, {
        fieldKey: `outline:${key}`,
        text: outlineText,
        submitted: true,
        resume: { stage: 3, sectionKey: sections[nextIndex]?.key ?? key, screen: "outline" },
        session: next,
      });
      setOutlineSaving(false);
      if (!ok) {
        setThinNote("Couldn't save the outline.");
        return;
      }
    }
    // The last section never jumps straight to Sources: she always asks
    // "Ready to move on to sources?" first (QA 10:38 #9).
  }

  async function onOutlineAside(intent: StanceIntent, key: string, more: LoopLine[]) {
    if (!session) return;
    const item = session.sections.find((sectionItem) => sectionItem.key === key);
    if (!item) return;
    const said = more.filter((l) => l.who === "you").map((l) => l.text).join(" ");
    const mode = answerModeFor(intent, said);
    setAnswering(true);
    let answered: string[] | null = null;
    try {
      answered = mode ? await coachAnswer(mode, said, item.title, more.find((l) => l.who === "pau")?.text ?? "") : null;
    } finally {
      setAnswering(false);
    }
    const paras = answered ?? intentReply(intent, { turn: "outline", section: item, text: said });
    const outlineTranscript = appendLines(session.outlineTranscript, [...more, ...paras.map((text): LoopLine => ({ k: key, who: "pau", text }))]);
    commit({
      ...session,
      outlineTranscript,
      outlineAside: { k: key, at: outlineTranscript.length, paras: [], intent },
    });
  }

  function onOutlineReopen(key: string) {
    if (!session) return;
    commit({ ...session, outlineDone: (session.outlineDone ?? []).filter((k) => k !== key) });
  }

  const card =
    section?.mode === "lesson" && section.concept
      ? conceptTeachCard(pctx, section.rubricRef) ??
        // QA 10:21: before the paper context loads (or when it lost the pick), the lesson still
        // comes from THEIR words (thesis and notes), never the assignment's clause read back.
        conceptTeachCard({ decision: { pick: "", answer: [...session.answers.map((x) => x.text), ...session.sections.flatMap((x) => keptIdeas(x.ideas))].join(" ") }, leader: pctx?.leader ?? null }, section.rubricRef) ??
        contextTeachCard(pctx, section.rubricRef) ??
        defaultTeachCard(subject === "your topic" ? clipWords(section.concept, 60) : subject, section.rubricRef)
      : null;
  const followUp = section?.mode === "lesson" && idea.trim() ? teachThenAsk(idea) : null;
  const examples =
    section && section.mode === "lesson"
      ? exampleLeadBatch({
          concept: subject === "your topic" ? section.concept : subject,
          assignmentText: subject === "your topic" ? session.assignmentText : subject,
          studentIdea: keptIdeas(section.ideas).join(" "),
          rubricRef: section.rubricRef,
          section: { key: section.key, title: section.title },
          searchTerm: searchTerms.key === termCacheKey ? searchTerms.map[section.key] ?? null : null,
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
      {stage >= 4 ? (
        <div className="mb-4 flex items-center gap-3">
          {/* Sources already has a shell in PLAN.md; presence only, no Stage 4 logic. */}
          {stage === 4 ? <PauFace alive className="h-10 w-10 shrink-0" /> : null}
          <p className={dsEyebrow}>
            Stage {stage} of {STAGE_LABELS.length} · {STAGE_LABELS[stage - 1]}
          </p>
        </div>
      ) : null}

      {stage === 2 && section && !introReady ? (
        <p className="text-sm text-rw-ink" role="status">
          Opening Stance…
        </p>
      ) : null}
      {stage === 2 && section && introReady ? (
        <StanceChat
          skeleton={skeleton}
          earlier={stage1Past}
          paperId={paperId}
          intro={{
            ...stage2IntroText(pctx?.readback, {
              heading: stageLessonHeader(subject, lesson.statement),
              body:
                session.extraction.promptType === "personal_experience"
                  ? "This looks like a personal-story assignment. We'll help you remember and tell it."
                  : subject === "your topic"
                    ? "The assignment topic is still missing. Add it on the checklist before this lesson."
                    : isQuestionTopic(subject)
                      ? "This is the question your paper answers. We'll work through it one section at a time."
                      : assignmentPurposeLine(subject),
            }),
            purpose: STAGE_PURPOSE[2],
            earlier: stage2Earlier(pctx?.decision, pctx?.leader, pctx?.options?.options ?? []),
            material: materialList(pctx),
          }}
          promptType={session.extraction.promptType}
          lessonLabel={lessonKindLabel(session.assignmentText)}
          sections={session.sections}
          active={active}
          kind={stanceTurnFor(
            {
              mode: section.mode,
              loopStep: section.loopStep,
              status: section.status,
              hasLogic: Boolean(section.logic),
              logicRevealed: section.logicRevealed,
            },
            { hasCard: Boolean(card), personalized: Boolean(examples?.personalized), hasBatch: Boolean(batch) },
          )}
          card={card}
          followUpCard={followUp?.kind === "teach_then_ask" ? followUp.card : null}
          mirrorAsk={mirrorQuestion(lesson.emotionalTerms, session.assignmentText)}
          triggers={
            section.mode === "memory"
              ? triggersForStudent({
                  under18: false,
                  hiddenIds: session.hiddenTriggers,
                  refresh: session.triggerRefresh,
                  theme: "general",
                })
              : null
          }
          activeTrigger={session.activeTrigger}
          safetyNote={session.safetyNote}
          leadsPending={Boolean(termCacheKey) && termsWait === termCacheKey && !(searchTerms.key === termCacheKey && searchTerms.map[section.key])}
          batch={
            batch
              ? {
                  ranked: batch.ranked,
                  wildcard: batch.wildcard,
                  capReached: batch.capReached,
                  searchPrompt: batch.capReached
                    ? buildGoogleSearchPrompt({
                        section: section.title,
                        rubricTerms: [section.concept ?? "assignment"],
                        storyAngle: lesson.statement,
                      })
                    : null,
                }
              : null
          }
          transcript={session.transcript ?? []}
          aside={session.aside ?? null}
          asideChips={asideChips}
          classify={classifyIntent}
          onAside={onAside}
          busy={checkingLogic || answering}
          idea={idea}
          onIdea={(value) => {
            paste.onChange(idea, value);
            // Sent (or cleared): the saved draft goes too, here and on the server.
            const key = stanceDraftKey(section?.key);
            if (!value.trim() && idea.trim() && key) {
              delete unsentDrafts.current[key];
              clearLocalDraft(paperId, key);
              if (persist) void persistField(paperId, { fieldKey: key, text: "", submitted: false, resume: draftPointer({ stage: 2, sectionKey: section?.key ?? null }) });
            }
            setIdea(value);
          }}
          onPaste={paste.onPaste}
          onDrop={paste.onDrop}
          thinNote={thinNote}
          noteStatus={noteStatus}
          skipped={skipped.map((item) => ({ key: item.key, title: item.title }))}
          voiceNote={voice.note}
          handlers={{
            teachAspect: onTeachAspect,
            teachSkip: onTeachSkip,
            mirrorSave: (more, text) => onMirrorSave(more, text),
            probeSave: (more, opts) => onProbeSave(more, opts),
            followUpAspect: (aspect) => {
              if (!section) return;
              updateSection(section.key, { teachAspect: aspect, teachStatus: "explored" });
              log("teach_then_ask_shown");
            },
            followUpSkip: () => section && updateSection(section.key, { teachStatus: "skipped_known" }),
            triggerPick: (trigger: MemoryTrigger) =>
              setSession({ ...session, activeTrigger: trigger.line, events: [...session.events, "memory_trigger_picked"] }),
            triggerHide: (trigger) => setSession({ ...session, hiddenTriggers: [...session.hiddenTriggers, trigger.id] }),
            triggersSkip: () => log("memory_triggers_skipped"),
            nameLead: onNameLead,
            pickLead: onPickLead,
            confirm: onConfirm,
            logicOpener: onLogicOpener,
            logicResult: onLogicResult,
            skipSection: onSkipSection,
            discuss: onDiscuss,
            jumpTo: (index) => {
              if (index < 0) return;
              setActive(index);
              commit({ ...session, activeIndex: index });
              log("section_skip_reminder_clicked");
            },
            promptType: onPromptType,
          }}
        />
      ) : null}

      {stage === 3 &&
      productStageBounce({ stage, progress: stageProgress, sections: session.sections }) === "stay" ? (
        <OutlineChat
          skeleton={skeleton}
          earlier={stage2Past}
          pick={pctx?.decision ? pickPhrase(pctx.decision, pctx.options?.options ?? []) : null}
          leader={pickedLeader(pctx ? { leader: pctx.leader ?? undefined, decision: pctx.decision ?? undefined, options: pctx.options ?? undefined } : null)}
          paperId={paperId}
          persist={persist}
          voice={persist && paperStage === 3}
          sections={session.sections}
          done={session.outlineDone ?? []}
          transcript={session.outlineTranscript ?? []}
          aside={session.outlineAside ?? null}
          classify={classifyIntent}
          onAside={onOutlineAside}
          flags={Object.fromEntries(
            session.sections
              .filter((item) => item.continued && item.logic && item.logic.result.tier !== "pass")
              // QA 1:11 AM #2: an off-prompt flag from the old question extraction (sources line read as the
              // question) doesn't carry into Stage 3 when the notes do answer the real question.
              .filter(
                (item) =>
                  !(item.logic!.result.citedTerm?.rubricRef === "prompt" || /doesn't answer the question your prompt asks/i.test(item.logic!.result.reason ?? "")) ||
                  !notesOnPrompt(keptIdeas(item.ideas).join(" "), realQuestion, session.assignmentText ?? ""),
              )
              .map((item) => [item.key, item.logic!.result.reason || LOGIC_STRONG_HEADLINE]),
          )}
          saving={outlineSaving || moving}
          error={thinNote}
          skipped={skipped.map((item) => ({ key: item.key, title: item.title }))}
          voiceNote={voice.note}
          onSend={(key, text, more) => void onOutlineSend(key, text, more)}
          onReopen={onOutlineReopen}
          onFinish={() => void finishOutline(session)}
          onGoBack={(key) => {
            setActive(session.sections.findIndex((sectionItem) => sectionItem.key === key));
            log("section_skip_reminder_clicked");
            router.push(`/app/papers/${paperId}/stage/2`);
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
          <p className="text-sm text-rw-ink/75">{wordCount(session.draft)} words</p>
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

      {skipped.length > 0 && stage >= 4 && stage <= 5 ? (
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
        className={`mt-3 min-h-[160px] w-full ${dsTextarea}`}
        rows={6}
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
            <p className={`mt-2 ${dsBody}`}>Look up: {visibleSourceLead(item.chosenLead)}</p>
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

/** Where a Stage 2 section's unsent note is saved (server field and device copy). */
export function stanceDraftKey(sectionKey: string | null | undefined): string | null {
  return sectionKey ? `stance:${sectionKey}:draft` : null;
}

/** The first section with an unsent Stage 2 note, or -1. */
export function unsentSection(keys: string[], unsent: (key: string) => string): number {
  return keys.findIndex((key) => unsent(key).trim().length > 0);
}
