"use client";

import type { DecisionOption } from "@/lib/stage1/paper-context";
import { diagnoseQuestion, informedAffirm, informedStoryAsk, lostOffer, informedNext, informedSaying, lostLead } from "@/lib/stage1/north-turns";
import { fillerNudge, isFillerSaying, withoutFiller, isAmbiguousReply, isConfusedSaying, isNoSaying, isUnsureReadSaying, isYesSaying, pickEscalation, scrubUnreadRefs } from "@/lib/stage1/north-turns";
import { fetchWithTimeout } from "@/lib/net/fetch-timeout";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DsButton } from "@/components/ui/ds-button";
import { asQuestion, isQuestionTopic, topicMidSentence } from "@/lib/copy/topic-phrase";
import { PauPauConfirm } from "@/components/stages/stage1/pau-pau-confirm";
import { RealtimeControls, useRealtimeCall, useRealtimeFlag } from "@/components/stages/loop/realtime-voice";
import { typingArbiter } from "@/lib/voice/realtime/arbiter";
import { LiveTurns } from "@/components/stages/loop/live-turns";
import { appendSpoken, isControlPhrase, isSaidToCoach, questionsRendered, Stage1VoicePacer, stage1VoiceScreen } from "@/lib/stage1/voice-turn";
import {
  decisionHasReason,
  decisionQuestion,
  isLostSaying,
  isPreparedSaying,
  isSkipSaying,
  isGetToKnowSkip,
  assignmentDecisionAsk,
  parseStance,
  mayNeedLookup,
  guessPick,
  isReadingQuestion,
  looksLikePastedReading,
  isVaguePick,
  overlapsTeaching,
  stripReadingRefusal,
  vaguePickProbe,
  withoutDarkWeb,
  uploadOfferOnly,
  STAGE_PURPOSE,
  summaryLabel,
  summaryParas,
  pastedReadingParas,
  summarySpoken,
  type MaterialSummary,
  type PaperContext,
  type ReadbackPlain,
} from "@/lib/stage1/paper-context";
import {
  CONFIRM_CHAT_FIELD,
  isQuickConfirm,
  parseConfirmTurns,
  replayTurns,
  trimTurns,
  type ConfirmTurn,
} from "@/lib/stage1/confirm-reply";
import { readScoped, writeScoped } from "@/lib/local/user-scope";
import { FocusOpener, useFocusReturn } from "@/components/stages/stage1/welcome-back";
import { FocusBar, PastChatPanel, SkeletonPanel, STAGE1_PAST_KEY, parsePastLines, type PastLine } from "@/components/stages/focus-panels";
import { useSkeleton } from "@/lib/skeleton/use-skeleton";
import { CoachEyebrow } from "@/components/coaching/pau-pau";
import { COACH_NAME } from "@/lib/stage1/pau-pau";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  extractStagedFile,
  type StagedAssignmentFile,
} from "@/components/stages/stage1/upload-panel";
import { ChatComposer } from "@/components/stages/stage1/chat-composer";
import {
  ComposerDock,
  EchoBubble,
  PickedChip,
  shortLabel,
  PauPauBubble,
  PauPauGroup,
  ReadingBubble,
  ScrollToNewest,
  SENT_FIELD_KEY,
  StudentBubble,
  parseSentMessage,
  readSentMessage,
  saveSentMessage,
  trimSent,
  type SentMessage,
} from "@/components/stages/stage1/chat-bubbles";
import { readBackParas } from "@/lib/stage1/pau-pau";
import { ASSIGNMENT_ASK, ASSIGNMENT_GREETING, INTRO_BUBBLES, PLACEHOLDERS, MORE_WORDS_NOTE, isSolidReason, moreWordsNote } from "@/lib/stage1/chat-copy";
import {
  assertAssignmentConfirmGate,
  markFieldConfirmed,
  markNotSpecified,
} from "@/lib/assignment/confirm";
import {
  AI_POLICY_NOTICE,
  needsAiPolicyAck,
} from "@/lib/assignment/ai-policy-notice";
import { requirementsHaveFacts } from "@/lib/assignment/coerce";
import { storeOriginals } from "@/lib/assignment/store-originals";
import { formatLengthLabel } from "@/lib/assignment/pages-to-words";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import { UNREADABLE_ASSIGNMENT } from "@/lib/papers/account";
import { parseLinkField } from "@/lib/assignment/provided-sources";
import { extractFileText } from "@/lib/assignment/client-extract";
import {
  emptyField,
  emptyRequirements,
  type AssignmentRequirements,
  type CitationStyle,
  type Field,
  type RequiredSourcesValue,
} from "@/lib/assignment/schema";
import {
  STAGE1_VOICE_MIN_WORDS,
} from "@/lib/config";
import {
  getDemoPaper,
  upsertDemoPaper,
  type DemoPaper,
} from "@/lib/demo/store";
import { EARLY_STANCE_MIN_NOTE, earlyStanceQuestion } from "@/lib/stage1/early-stance";
import { extractInterestTags } from "@/lib/stage1/interest-tags";
import { preferLocalPosition, readLocalPosition, saveLocalPosition } from "@/lib/stage1/local-position";
import { createLead, exampleLeadWhy, interestDisplay, LEADS_INTRO, leadLinks, leadSearchTerms, practitionerReason, practitionerSearchTerms, type ResearchLeadDraft } from "@/lib/stage1/leads";
import { buildStoryAngleFallback, styleWordFrom } from "@/lib/stage1/story-angles";
import { clipWords } from "@/lib/copy/clip";
import { isContentQuestion } from "@/lib/coach/answer";
import { displayWork, namedWorksFrom } from "@/lib/stage1/readings";
import {
  evaluateStage1VoiceMinimum,
  readyVoiceLine,
  tallyVoiceWords,
  type VoiceAnswer,
} from "@/lib/stage1/voice";
import { usePasteMeta } from "@/lib/hooks/use-paste-meta";
import { persistField } from "@/lib/papers/persist";
import { useTurnRecorder } from "@/lib/chat/turn-recorder";
import { clearLocalDraft, newerDraftText, readLocalDraft } from "@/lib/papers/local-draft";
import { draftPointer, restoreDraftText } from "@/lib/papers/draft-resume";
import { useDraftSave } from "@/lib/papers/use-draft-save";
import { SaveStatus } from "@/components/stages/save-status";
import {
  answersAfterSkippingInterest,
  intakeScreenAfterLoad,
  resumeIntake,
  stanceStartBlockers,
  voiceShortNote,
  materialGateLabel, northstarChecklist,
  northstarGateFrom,
  shortNoteNudge,
} from "@/lib/stage1/intake-resume";
import { computeStyleMetrics } from "@/lib/style/metrics";
import { cn, wordCount } from "@/lib/utils";
import { Check, Info } from "lucide-react";
import { citationComfortQuestion } from "@/lib/stage1/comfort";
import { ChatHeader, ReplayButton, SpeakNew, useStopSpeechOnUnmount } from "@/components/stages/stage1/voice";
import {
  SPARK_DECLINED,
  SPARK_OFF,
  SparkExchange,
  loadSparks,
  saveSparks,
  useHesitation,
  type SparkTurn,
} from "@/components/stages/stage1/hesitation";
import { setChatPref, useChatPrefs } from "@/lib/voice/prefs";
import { SPARK_OFFER } from "@/lib/stage1/spark";
import type { SpeakItem } from "@/lib/voice/speech";
import { dsCaption, dsEyebrow, dsH1, dsInput, dsLink, dsSelect, dsTextarea } from "@/lib/ds/classes";

type Screen =
  | "upload"
  | "parsing"
  | "card"
  | "followup"
  | "ai_policy"
  | "coaching"
  | "story"
  | "gate";

type IntakeAnswer = {
  questionId: string;
  questionText: string;
  kind:
    | "interest"
    | "coaching"
    | "personal"
    | "fallback_voice"
    | "background"
    | "story_angle";
  answerText: string;
  isVoiceSample: boolean;
  pasteRatio?: number;
};

type StoryAngle = {
  id: string;
  question: string;
  whyFits: string;
  fromStudentPhrase?: string;
};

type Props = {
  paperId: string;
  demoMode?: boolean;
  accountPaper?: DemoPaper | null;
  initialRequirements?: AssignmentRequirements | null;
  initialRawText?: string;
};

const CITATION_OPTIONS: Array<CitationStyle | ""> = [
  "",
  "APA 7",
  "MLA 9",
  "Chicago 17 Notes",
  "Chicago 17 Author-Date",
  "Harvard",
  "IEEE",
  "AMA",
  "other",
];

/** QA 11:40 #1: a typed "haven't read", "idk", "not sure", "no clue" gets the catch-up, same as the button. */
function materialLost(text: string): boolean {
  // QA 11:08: the saved decline ("…Let's pick a direction.") is never "lost", so no summary follows it.
  if (/^\s*No thanks, skip the summary/i.test(text)) return false;
  return isLostSaying(text) || isUnsureReadSaying(text);
}

/** QA 11:08: a second filler on the same question: no second ask (the question is still right there). */
const FILLER_AGAIN = "No rush. Whenever you're ready.";

/** Stage 1 questions that need their own words (no Skip). */
const STAGE1_REQUIRED_QS = ["material_check", "decision_pick", "decision_why", "stance_early"];

/** QA 3:51: a message that arrives after Stage 1 wrapped up (sent while her last reply was coming). */
export const GATE_SAID_REPLY =
  "Got it. Stage 1 is wrapped, so I didn't change your answers. If this should replace one, tap it above. Otherwise, bring it into the stance interview.";

const CAUSAL_LINK = /\b(because|so|since|led to|leads to|leading to|which meant|as a result|that's why|caused|therefore)\b/i;
const MATERIAL_CHECK_TEXT =
  "Before we dig in: have you read the course material for this yet? If not, or you're not sure where to start, say so and I'll give you the key points first. You can also add a reading: paste it or upload the file.";

/** Pau's summary of the material: labeled, with its sources. Teaching content, never paper text. */
function SummaryBubbles({ summary, lead }: { summary: MaterialSummary; lead?: string }) {
  const paras = summaryParas(summary);
  return (
    <PauPauGroup
      bubbles={[
        ...(lead ? [lead] : []),
        <div key="sum" className="space-y-2" data-material-summary aria-label={summaryLabel(summary)}>
          {paras.map((t, i) => (
            <p key={i} className={i === 0 ? "font-semibold" : undefined}>
              {t}
            </p>
          ))}
          {summary.sources.length ? (
            <p className="text-[13px] leading-[1.6] text-ds-muted">
              Sources:{" "}
              {summary.sources.map((src, i) => (
                <span key={src.url}>
                  {i ? " · " : ""}
                  <a href={src.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {src.title || src.url}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>,
      ]}
    />
  );
}

type MoreResult = {
  id: number;
  mode: string;
  points?: string[];
  groups?: { title: string; kind?: string; points: string[] }[];
  videos?: { title: string; url: string }[];
};

/** One "Go deeper" / "Say it simpler" / video result: every reading keeps its own heading (QA 6:03 AM). */
function moreBubbles(more: MoreResult): ReactNode[] {
  if (more.mode === "video") {
    return more.videos?.length
      ? [
          "Here's a video that explains it:",
          <ul key="v" className="space-y-1 text-[14px]">
            {more.videos.map((v) => (
              <li key={v.url}>
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {v.title}
                </a>
              </li>
            ))}
          </ul>,
        ]
      : ["I couldn't find a video I'd trust for this one. Want me to go deeper or say it simpler instead?"];
  }
  const head = more.mode === "depth" ? "One level deeper:" : "Simpler version:";
  const groups = (more.groups ?? []).filter((g) => g.points.length);
  if (groups.length > 1) {
    return [
      head,
      <div key="g" className="space-y-3" data-more-groups>
        {groups.map((g) => (
          <div key={g.title}>
            <p className="font-semibold">{g.title}</p>
            <ul className="list-disc space-y-1 pl-5">
              {g.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>,
    ];
  }
  const pts = groups[0]?.points ?? more.points ?? [];
  return pts.length ? [groups[0] ? `${head} ${groups[0].title}` : head, ...pts.map((p) => `• ${p}`)] : ["I couldn't pull that together just now. Try again in a sec?"];
}

/** "Find me a video", fetched ahead once per paper (QA 7:02 AM: it took ~12 s on tap). */
const videoAhead = new Map<string, Promise<Omit<MoreResult, "id" | "mode"> | null>>();
/** "Go deeper" / "Say it simpler" results survive the bubble moving into the history (QA 8:31 AM). */
const moreKept = new Map<string, MoreResult[]>();
function moreFetch(paperId: string, mode: "depth" | "simpler" | "video"): Promise<Omit<MoreResult, "id" | "mode"> | null> {
  return fetch(`/api/papers/${paperId}/intake/brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "material_more", mode }),
  })
    .then((res) => res.json().catch(() => null) as Promise<Omit<MoreResult, "id" | "mode"> | null>)
    .catch(() => null);
}

/** Every summary she has (each labeled by where it came from), then her honest ask with legit links. */
function MaterialBubbles({
  brief,
  lead,
  paperId,
  darkWebOk = true,
}: {
  brief: {
    summary: MaterialSummary | null;
    summaries?: MaterialSummary[];
    missingAsk?: string | null;
    whereToGet?: { title: string; offers: { seller: string; url: string; price?: string | null }[] }[];
  };
  lead: string;
  paperId?: string;
  /** "I'm not going to the dark web!" at most once per paper. */
  darkWebOk?: boolean;
}) {
  const list = brief.summaries?.length ? brief.summaries : brief.summary ? [brief.summary] : [];
  // Results stack up (QA 6:03 AM): a new tap appends, never replaces the last one.
  const [more, setMore] = useState<MoreResult[]>(() => (paperId ? moreKept.get(paperId) ?? [] : []));
  const lastMore = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (paperId) moreKept.set(paperId, more);
    // The new result is where they're looking, even when this bubble sits up in the history.
    if (more.length) lastMore.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [more, paperId]);
  const [moreBusy, setMoreBusy] = useState<string | null>(null);
  const [moreAt, setMoreAt] = useState(0);
  const hasList = list.length > 0;
  useEffect(() => {
    if (!paperId || !hasList || videoAhead.has(paperId)) return;
    videoAhead.set(paperId, moreFetch(paperId, "video"));
  }, [paperId, hasList]);
  const ask = async (mode: "depth" | "simpler" | "video", at: number) => {
    if (!paperId || moreBusy) return;
    setMoreBusy(mode);
    setMoreAt(at);
    try {
      const ahead = mode === "video" ? videoAhead.get(paperId) : undefined;
      if (ahead) videoAhead.delete(paperId);
      let d = ahead ? await ahead : null;
      if (!d) d = await moreFetch(paperId, mode);
      setMore((prev) => [...prev, { id: Date.now(), mode, points: d?.points, groups: d?.groups, videos: d?.videos }].slice(-6));
    } finally {
      setMoreBusy(null);
    }
  };
  const offers = (brief.whereToGet ?? [])
    .flatMap((w) => w.offers.map((o) => ({ ...o, title: w.title })))
    .filter((o, i, all) => all.findIndex((x) => x.url === o.url || (x.title === o.title && x.seller === o.seller)) === i);
  const missingAsk = brief.missingAsk
    ? hasList
      ? uploadOfferOnly(brief.missingAsk)
      : darkWebOk
        ? brief.missingAsk
        : withoutDarkWeb(brief.missingAsk)
    : null;
  return (
    <div className="space-y-4">
      {list.map((s, i) => (
        <SummaryBubbles key={`${s.kind}:${s.title}`} summary={s} lead={i === 0 ? lead : undefined} />
      ))}
      {more.map((m, i) => (
        <div key={m.id} ref={i === more.length - 1 ? lastMore : undefined} data-more-result={m.mode}>
          <PauPauGroup bubbles={moreBubbles(m)} />
        </div>
      ))}
      {moreBusy ? (
        <ReadingBubble
          status={moreBusy === "video" ? "Looking for a video I'd trust…" : moreBusy === "depth" ? "Digging it up… going deeper." : "Digging it up… saying it simpler."}
          startedAt={moreAt}
        />
      ) : null}
      {list.length && paperId ? (
        <div className="flex flex-wrap gap-2 pl-11" role="group" aria-label="More on the material">
          {(
            [
              ["depth", "Go deeper"],
              ["simpler", "Say it simpler"],
              ["video", "Find me a video"],
            ] as const
          ).map(([mode, label]) => (
            <DsButton key={mode} type="button" size="sm" variant="secondary" disabled={Boolean(moreBusy)} onClick={(e) => void ask(mode, Math.round(performance.timeOrigin + e.timeStamp))}>
              {moreBusy === mode ? "One sec…" : label}
            </DsButton>
          ))}
        </div>
      ) : null}
      {missingAsk ? (
        <PauPauGroup
          bubbles={[
            // Colton 12:08: no summary yet, still reassure and teach first (only when this is the lost turn's lead).
            ...(!list.length && lead.startsWith("That's okay") ? [lead] : []),
            missingAsk,
            ...(offers.length
              ? [
                  <ul key="offers" className="space-y-1 text-[14px] leading-[1.6]" aria-label="Where to get the reading" data-reading-offers>
                    {offers.map((o) => (
                      <li key={o.url}>
                        <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                          {o.title} at {o.seller}
                        </a>
                        {o.price ? <span className="text-ds-muted"> · {o.price} (price from search; check the page)</span> : null}
                      </li>
                    ))}
                  </ul>,
                ]
              : []),
          ]}
        />
      ) : null}
    </div>
  );
}

const INTEREST_Qs = [
  {
    id: "interest_1",
    text: "What topics, hobbies, or people do you actually enjoy following right now?",
  },
  {
    id: "interest_2",
    text: "Is there a story, show, sport, job, or place that gets you talking?",
  },
];

/** Types and named sources ("Must include: AAP 2014…") both show in the box. */
function requiredSourcesText(value: RequiredSourcesValue | null | undefined): string {
  if (!value) return "";
  const parts: string[] = [];
  const types = value.types?.trim();
  if (types) parts.push(types);
  else if (value.countMin) parts.push(`At least ${value.countMin} sources`);
  const notes = value.notes?.trim();
  if (notes && !parts.some((part) => part.includes(notes))) parts.push(notes);
  return parts.join("\n");
}

function fieldNeedsAttention(field: Field<unknown>) {
  return field.confidence < 0.6 || field.source === "missing";
}

/** PC-28: what the Stage 1 welcome line names (the last thing finished, what's next). */
export function stage1Fill(screen: string, qIndex: number): { done: string | null; next: string } {
  if (screen === "card") return { done: "reading your assignment", next: "checking I got it right" };
  if (screen === "story") return { done: "the warm-up questions", next: "picking your angle" };
  if (screen === "gate") return { done: "every Stage 1 question", next: "the Stage 1 checklist" };
  if (screen === "coaching" && qIndex < 0) return { done: "the warm-up questions", next: "your early take" };
  if (screen === "coaching") return { done: qIndex > 0 ? `question ${qIndex}` : "your assignment read-back", next: `question ${qIndex + 1}` };
  return { done: null, next: "the next step" };
}

export function AssignmentIntake({
  paperId,
  demoMode = false,
  accountPaper = null,
  initialRequirements = null,
  initialRawText = "",
}: Props) {
  const router = useRouter();
  const resumedIntake = useRef(false);
  const pendingQuestion = useRef<string | null>(null);
  const pasteMeta = usePasteMeta();
  const [paper, setPaper] = useState<DemoPaper | null>(null);
  const [screen, setScreen] = useState<Screen>("upload");
  const [resumeReady, setResumeReady] = useState(demoMode);
  /** A reload is still working out which screen and question to reopen. */
  const [resumePending, setResumePending] = useState(!demoMode);
  const [paste, setPaste] = useState("");
  const [links] = useState("");
  const [rightsOk, setRightsOk] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedAssignmentFile[]>([]);
  /** What the student sent in the chat box, shown as their bubble above Pau's reply. */
  const [sentMessage, setSentMessage] = useState<SentMessage | null>(null);
  // The conversation about the read-back (PLAN.md 9), saved per paper.
  const [confirmTurns, setConfirmTurnsState] = useState<ConfirmTurn[]>([]);
  const [confirmReady, setConfirmReady] = useState(false);
  const confirmReplayed = useRef(false);
  const setConfirmTurns = useCallback(
    (next: ConfirmTurn[]) => {
      const trimmed = trimTurns(next);
      setConfirmTurnsState(trimmed);
      try {
        writeScoped(`confirm-chat:${paperId}`, JSON.stringify(trimmed));
      } catch {
        /* private mode */
      }
      if (!demoMode) void persistField(paperId, { fieldKey: CONFIRM_CHAT_FIELD, text: JSON.stringify(trimmed) });
    },
    [paperId, demoMode],
  );
  const [parseStatus, setParseStatus] = useState("Extracting the text…");
  const [parseStartedAt, setParseStartedAt] = useState(() => Date.now());
  const [requirements, setRequirements] =
    useState<AssignmentRequirements | null>(null);
  const [rawText, setRawText] = useState("");
  const [answers, setAnswers] = useState<IntakeAnswer[]>([]);
  const [leads, setLeads] = useState<ResearchLeadDraft[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  // Continue awaits the answer save (~1s, longer on a cold start). Show that and
  // ignore repeat clicks so the button never looks dead or double-submits.
  const [submitting, setSubmitting] = useState(false);
  const sendLock = useRef(false);
  const [skippedInterest, setSkippedInterest] = useState(false);
  const [needFallback, setNeedFallback] = useState(false);
  const [error, setErrorRaw] = useState<string | null>(null);
  // QA 1:16 (composer): a send that's turned back (an error) puts their words back in the box.
  const rejectedRef = useRef(false);
  const setError = useCallback((m: string | null) => {
    if (m) rejectedRef.current = true;
    setErrorRaw(m);
  }, []);
  // Rapid sends inside a short window merge into ONE turn (both messages kept, one reply).
  const coalesce = useRef<{ text: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [pendingSaid, setPendingSaid] = useState<string | null>(null);
  // QA 3:00: a message typed while Pau is replying waits here (shown in the chat) and goes right after.
  const queuedRef = useRef<string | null>(null);
  const [queuedSaid, setQueuedSaid] = useState<string | null>(null);
  // QA 3:51: a message queued during her last Stage 1 reply lands after the step closed (the gate has
  // no question to take it). It still shows, in order, with an honest reply; it is never dropped.
  // QA 5:46: the box is cleared only at the moment of Enter (the send handler takes the text and
  // empties the box in the same tick). Anything that runs later (a reply landing, a save resolving)
  // never wipes what they typed since; it only clears the box if it still holds exactly what was sent.
  const dropSent = (sent?: string) => setDraftAnswer((d) => (!d.trim() || (sent !== undefined && d.trim() === sent.trim()) ? "" : d));
  // Moving to the next step after a reply: its saved answer / prefill goes in only if they haven't typed since.
  const setBoxUnlessTyped = (next: string, sent?: string) =>
    setDraftAnswer((d) => (d.trim() && d.trim() !== (sent ?? "").trim() ? d : next));
  const dropSentStory = (sent?: string) => setOwnStory((d) => (!d.trim() || (sent !== undefined && d.trim() === sent.trim()) ? "" : d));
  const [gateSaid, setGateSaid] = useState<{ id: number; said: string }[]>([]);
  const latestSendNow = useRef<((text: string, fromBox: boolean) => boolean | void) | null>(null);
  // Colton 1:54 R1: what a lost student first said, kept while the summary offer is open.
  const offerSaid = useRef<string | null>(null);
  // A too-short answer still shows as a student bubble above the nudge.
  const [shortEcho, setShortEcho] = useState<string | null>(null);
  // Bumps on every edit so read-aloud treats the re-asked question as new.
  const [editSeq, setEditSeq] = useState(0);
  const [aiPolicyAck, setAiPolicyAck] = useState(false);
  const [followupAsked, setFollowupAsked] = useState(false);
  const [checklistConfirmed, setChecklistConfirmed] = useState(false);
  // North star (Colton t161u): the paper context — plain read-back, the material
  // summary (Pau's teaching content, never paper text), the options and their decision.
  type BriefView = {
    northstar: boolean;
    /** False until the read-back decides whether this paper runs the north-star plan. */
    northstarSet?: boolean;
    readback: ReadbackPlain | null;
    summary: MaterialSummary | null;
    options: PaperContext["options"] | null;
    decision: PaperContext["decision"] | null;
    leader?: PaperContext["leader"] | null;
    lostAtStart: boolean;
    /** The summary was shown before the confirm: material_check is never asked (QA 7:02 AM). */
    materialShown?: boolean;
    hasReading: boolean;
    missing?: string[];
    missingAsk?: string | null;
    whereToGet?: { title: string; known: boolean; offers: { seller: string; url: string; price?: string | null }[] }[];
    summaries?: MaterialSummary[];
  };
  const [brief, setBrief] = useState<BriefView | null>(null);
  const [briefLoaded, setBriefLoaded] = useState(demoMode);
  const [summaryBusy, setSummaryBusy] = useState(false);
  /** The question where they said they were lost again: the key points are offered there. */
  const [reoffer, setReoffer] = useState<string | null>(null);
  /** Questions and pastes answered in place during the interview (QA 6:03 AM): never saved as answers. */
  const [qaAsides, setQaAsides] = useState<{ id: number; qid: string; said: string; paras: string[]; filler?: boolean }[]>([]);
  // QA 3:26 AM #5: the Stage 1 turns as shown, saved so Past chat (here and in later stages) can replay them.
  const [savedPast, setSavedPast] = useState<PastLine[]>([]);
  const recordedPast = useTurnRecorder({ enabled: true, saved: savedPast });
  // The pending bubble gives way as soon as the turn is on screen (no doubled student bubble).
  useEffect(() => {
    setPendingSaid(null);
  }, [answers.length, qaAsides.length]);
  const [asideBusy, setAsideBusy] = useState<string | null>(null);
  const [readingOpen, setReadingOpen] = useState(false);
  const [readingText, setReadingText] = useState("");
  const [readingBusy, setReadingBusy] = useState(false);
  const [readingLink, setReadingLink] = useState("");
  const [readingNote, setReadingNote] = useState<string | null>(null);
  const briefRef = useRef<BriefView | null>(null);
  /** How many times the early take came back short (QA 8:31 AM: the nudge changes each time). */
  const shortTries = useRef(0);
  briefRef.current = brief;
  // PC-29 QA round 3: brief calls in flight (the plan can still re-shape while one is out), so the
  // call never says a prompt that is about to change, and Stage 1 never ends before the last save.
  const briefPending = useRef(0);
  const briefIdleWaiters = useRef<(() => void)[]>([]);
  const briefIdle = useCallback(
    (maxMs: number) =>
      new Promise<void>((resolve) => {
        if (briefPending.current <= 0) return resolve();
        const t = setTimeout(resolve, maxMs);
        briefIdleWaiters.current.push(() => {
          clearTimeout(t);
          resolve();
        });
      }),
    [],
  );
  const briefCall = useCallback(
    async (body: Record<string, unknown>): Promise<BriefView | null> => {
      if (demoMode) return null;
      briefPending.current += 1;
      try {
        // A stalled call never hangs the chat (QA 9:37 AM).
        const res = await fetchWithTimeout(`/api/papers/${paperId}/intake/brief`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }, 30_000);
        if (!res) {
          setError("That took longer than it should on my end. Send it again, or keep going.");
          return null;
        }
        const data = (await res.json().catch(() => null)) as (BriefView & { ok?: boolean; error?: string }) | null;
        if (!res.ok || !data?.ok) {
          if (data?.error) setError(data.error);
          return null;
        }
        // Two calls in flight can answer out of order: a slower, older view never drops a decision,
        // leader, option list or summary the newer one already has (QA 11:40 #5, parallel loads).
        if ("northstar" in data)
          setBrief((prev) =>
            prev
              ? {
                  ...data,
                  decision: data.decision ?? prev.decision,
                  leader: data.leader ?? prev.leader,
                  options: data.options ?? prev.options,
                  summary: data.summary ?? prev.summary,
                }
              : data,
          );
        return data;
      } catch {
        return null;
      } finally {
        briefPending.current = Math.max(0, briefPending.current - 1);
        if (briefPending.current === 0) for (const w of briefIdleWaiters.current.splice(0)) w();
      }
    },
    [demoMode, paperId],
  );
  useEffect(() => {
    if (demoMode) return;
    void briefCall({ action: "context" }).finally(() => setBriefLoaded(true));
  }, [briefCall, demoMode]);
  // Until the read-back has decided north star (see the plan), check again; never wait forever.
  const [northstarWaitOver, setNorthstarWaitOver] = useState(false);
  const northstarPending = !demoMode && briefLoaded && Boolean(requirements) && brief?.northstarSet === false && !northstarWaitOver;
  useEffect(() => {
    if (!northstarPending) return;
    let n = 0;
    void briefCall({ action: "context" });
    const t = window.setInterval(() => {
      n += 1;
      if (n > 25) {
        setNorthstarWaitOver(true);
        return;
      }
      void briefCall({ action: "context" });
    }, 800);
    return () => window.clearInterval(t);
  }, [northstarPending, briefCall]);
  /** The field-by-field editor behind Pau's "Fix something". */
  const [editingDetails, setEditingDetails] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [startingStance, setStartingStance] = useState(false);
  const [storyAngles, setStoryAngles] = useState<StoryAngle[]>([]);
  const [storyAngle, setStoryAngle] = useState<{
    text: string;
    source: "ai" | "student";
  } | null>(null);
  const [ownStory, setOwnStory] = useState("");
  /** Which story is being saved: an angle id, "own", or null. Shown right away. */
  const [pickingStory, setPickingStory] = useState<string | null>(null);
  /** True while a reload is still fetching the saved draft for the open question. */
  const [restoringDraft, setRestoringDraft] = useState(false);
  /**
   * Editing an earlier answer (tapped its bubble): where the student was, and
   * what they had typed there, so sending the edit takes them straight back.
   */
  const [editReturn, setEditReturn] = useState<{ at: number | "story" | "gate" | "stance"; draft: string } | null>(null);
  // Draft text for the resumed question, held until that question is open so
  // it is never shown (or autosaved) under a different question.
  const draftRestore = useRef<{ questionId: string; text: string; opened: boolean; serverDone: boolean } | null>(null);
  const [viewSource, setViewSource] = useState<{
    label: string;
    excerpt: string;
  } | null>(null);

  useEffect(() => {
    setConfirmReady(false);
    confirmReplayed.current = false;
    let local: ConfirmTurn[] = [];
    try {
      local = parseConfirmTurns(readScoped(`confirm-chat:${paperId}`));
    } catch {
      local = [];
    }
    setConfirmTurnsState(local);
    if (local.length || demoMode) {
      setConfirmReady(true);
      return;
    }
    let cancelled = false;
    void fetch(`/api/papers/${paperId}/autosave`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: { drafts?: { fieldKey: string; text: string }[] } | null) => {
        if (cancelled) return;
        const saved = parseConfirmTurns(data?.drafts?.find((row) => row.fieldKey === CONFIRM_CHAT_FIELD)?.text);
        if (saved.length) setConfirmTurnsState((current) => (current.length ? current : saved));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setConfirmReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [paperId, demoMode]);

  // A reload before "looks good": put the student's corrections back on the card.
  useEffect(() => {
    if (!confirmReady || !requirements || confirmReplayed.current) return;
    confirmReplayed.current = true;
    if (requirements.topic.confirmed || requirements.promptQuestion.confirmed) return;
    if (confirmTurns.some((t) => t.role === "pau" && t.apply)) setRequirements(replayTurns(requirements, confirmTurns));
  }, [confirmReady, requirements, confirmTurns]);

  useEffect(() => {
    const local = readSentMessage(paperId);
    setSentMessage(local);
    if (local || demoMode) return;
    let cancelled = false;
    void fetch(`/api/papers/${paperId}/autosave`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: { drafts?: { fieldKey: string; text: string }[] } | null) => {
        const saved = parseSentMessage(data?.drafts?.find((row) => row.fieldKey === SENT_FIELD_KEY)?.text);
        if (!cancelled && saved) setSentMessage((current) => current ?? saved);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [paperId, demoMode]);

  useEffect(() => {
    setPaper(accountPaper ?? getDemoPaper(paperId) ?? null);
    if (!resumeReady || !initialRequirements) return;
    setRequirements(initialRequirements);
    setRawText(initialRawText);
    const confirmed = Boolean(initialRequirements.topic.confirmed || initialRequirements.promptQuestion.confirmed);
    if (confirmed) setChecklistConfirmed(true);
    // Already confirmed with Pau ("Let's go"): a reload goes on to the
    // first question instead of showing the read-back again.
    setScreen((current) => (current === "upload" ? (confirmed ? "coaching" : "card") : current));
  }, [paperId, accountPaper, initialRequirements, initialRawText, resumeReady]);

  useEffect(() => {
    resumedIntake.current = false;
    if (demoMode) return;
    let cancelled = false;
    // Start the draft read alongside the answers read instead of after it.
    const draftsRequest: Promise<{
      drafts?: { fieldKey: string; text: string; updatedAt?: string | null }[];
    } | null> = fetch(`/api/papers/${paperId}/autosave`)
      .then(async (res) => (res.ok ? res.json() : null))
      .catch(() => null);
    void fetch(`/api/papers/${paperId}/intake/answers`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((loaded: {
        answers?: IntakeAnswer[];
        storyAngle?: { text: string; source: "ai" | "student" } | null;
        resume?: { screen?: string | null; questionId?: string | null } | null;
      } | null) => {
        let data = loaded;
        if (cancelled) return;
        if (!data) {
          setResumePending(false);
          setResumeReady(true);
          return;
        }
        // A reload right after Next: the answer and position may not be on
        // the server yet. This device's copy is newer, so use it.
        const localPos = readLocalPosition(paperId);
        const serverAt = (data.resume as { at?: number } | null | undefined)?.at ?? null;
        if (preferLocalPosition(localPos, serverAt) && localPos) {
          const answered = localPos.answered;
          if (answered && !(data.answers ?? []).some((a) => a.questionId === answered.questionId)) {
            data = { ...data, answers: [...(data.answers ?? []), answered as IntakeAnswer] };
            void persistField(paperId, {
              fieldKey: `stage1:${answered.questionId}`,
              text: answered.answerText,
              submitted: true,
              resume: { stage: 1, questionId: localPos.questionId ?? answered.questionId, screen: "coaching", at: localPos.at },
            });
          }
          if (localPos.questionId) data = { ...data, resume: { screen: "coaching", questionId: localPos.questionId } };
        }
        if (data.answers?.length) setAnswers(data.answers);
        if (data.storyAngle?.text) setStoryAngle(data.storyAngle);
        const nextScreen = intakeScreenAfterLoad({
          resumeScreen: data.resume?.screen,
          resumeQuestionId: data.resume?.questionId,
          hasAnswers: Boolean(data.answers?.length),
        });
        if (nextScreen === "gate") {
          setChecklistConfirmed(true);
          setScreen("gate");
          resumedIntake.current = true;
        } else if (nextScreen === "story") {
          setScreen("story");
          resumedIntake.current = true;
        } else if (nextScreen === "coaching") {
          setScreen("coaching");
        }
        // Reload while typing the early take: reopen that box directly.
        const stanceOpen = nextScreen === "stance" && Boolean(data.storyAngle?.text);
        if (stanceOpen) {
          resumedIntake.current = true;
          setQIndex(-1);
          setScreen("coaching");
        } else if (nextScreen === "stance") {
          setChecklistConfirmed(true);
          setScreen("gate");
          resumedIntake.current = true;
        }
        const questionId = data.resume?.questionId ?? null;
        pendingQuestion.current = questionId;
        // Only the question screen needs the plan before it can open.
        if (nextScreen !== "coaching") setResumePending(false);
        else
          window.setTimeout(() => {
            if (!cancelled) setResumePending(false);
          }, 8000);
        if (questionId && (nextScreen === "coaching" || stanceOpen)) {
          // Show this browser's copy right away; the server copy replaces it
          // only if it is newer (for example, typed on another device).
          const local = readLocalDraft(paperId, `stage1:${questionId}`);
          const savedStance = stanceOpen
            ? data.answers?.find((answer) => answer.questionId === "stance_early")?.answerText ?? ""
            : "";
          draftRestore.current = {
            questionId,
            text: local?.text ?? savedStance,
            opened: stanceOpen,
            serverDone: false,
          };
          if (stanceOpen) {
            const text = local?.text ?? savedStance;
            setDraftAnswer((current) => (current.trim() ? current : text));
          }
          // Show "Restoring your draft…" until the text is in the box, even when
          // this browser has a copy (the question can open a beat before it).
          setRestoringDraft(true);
          // Never leave the box read-only if the question somehow never opens.
          window.setTimeout(() => {
            if (!cancelled) setRestoringDraft(false);
          }, 8000);
          void draftsRequest
            .then((saved) => {
              if (cancelled) return;
              const drafts = saved?.drafts ?? [];
              const serverText = restoreDraftText(drafts, questionId);
              const serverRow = drafts.find((row) => row.fieldKey === `stage1:${questionId}`);
              const text = newerDraftText(
                local,
                serverText ? { text: serverText, updatedAt: serverRow?.updatedAt ?? null } : null,
              );
              const target = draftRestore.current;
              if (!text || target?.questionId !== questionId || text === target.text) return;
              const shown = target.text;
              target.text = text;
              // Never replace anything the student typed since the page opened.
              if (target.opened) setDraftAnswer((current) => (current === shown ? text : current));
            })
            .finally(() => {
              if (cancelled) return;
              const target = draftRestore.current;
              if (target) target.serverDone = true;
              // Keep "Restoring your draft…" until the question has opened with
              // its text; the resume step clears it then.
              if (!target || target.opened) setRestoringDraft(false);
            });
        }
        setResumeReady(true);
      })
      .catch(() => {
        setResumePending(false);
        setResumeReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [paperId, demoMode]);

  // QA 11:40 #4: they've read it, or had the catch-up (the key points were shown to them).
  const [catchUpGiven, setCatchUpGiven] = useState(false);
  const materialAnswerNow = answers.find((a) => a.questionId === "material_check")?.answerText ?? "";
  const caughtUp =
    Boolean(brief?.materialShown) ||
    (Boolean(brief?.summary) && (Boolean(brief?.lostAtStart) || materialLost(materialAnswerNow) || catchUpGiven));
  /** QA 11:40 #2: vague rounds per pick question, the last thing said, and a pending recommendation. */
  const vagueRounds = useRef<Record<string, number>>({});
  const lastProbe = useRef<Record<string, string>>({});
  const recPending = useRef<Record<string, DecisionOption | null>>({});
  /** How many times they said no to her recommendation (QA 1:16: it only moves on after a no). */
  const recNos = useRef<Record<string, number>>({});
  // QA 3:51: switching between the story box and the answer box never strands what they typed mid-reply.
  const prevScreen = useRef(screen);
  useEffect(() => {
    const was = prevScreen.current;
    prevScreen.current = screen;
    if (was === screen) return;
    if (screen === "story" && draftAnswer.trim() && !ownStory.trim()) {
      setOwnStory(draftAnswer);
      setDraftAnswer("");
    } else if (was === "story" && screen === "coaching" && ownStory.trim() && !draftAnswer.trim()) {
      setDraftAnswer(ownStory);
      setOwnStory("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  const [catchUpOffer, setCatchUpOffer] = useState<string | null>(null);
  // QA 3:06 minor: after the catch-up offer, the transcript stays in order (their lost note, the offer, their yes, the summary).
  const [offerReply, setOfferReply] = useState<Record<string, string>>({});
  /** Colton 12:08 INFORMED: the affirmation leads the next question's turn (until they answer it). */
  const [informedLead, setInformedLead] = useState<string[] | null>(null);

  const [needWhy, setNeedWhy] = useState(false);
  /** An informed answer's stated decision is on its way to the server (see the plan). */
  const [decisionSaving, setDecisionSaving] = useState(false);
  // QA 11:26: the angle came from their decision (north star); the old "Which direction…?" turn never shows, even while the decision save lands.
  const [storyFromDecision, setStoryFromDecision] = useState(false);
  const coachingPlan = useMemo(() => {
    if (!requirements || !briefLoaded) return [] as { id: string; kind: IntakeAnswer["kind"]; text: string }[];
    // QA 11:08 (root cause of the hobbies line): a new paper's first brief comes before the read-back
    // sets "north star", so the plan briefly read as an old paper and its first question was the
    // optional hobbies one: drawn for a moment, recorded in Past chat and spoken. Wait for the answer.
    if (brief && brief.northstarSet === false && !answers.length && !northstarWaitOver)
      return [] as { id: string; kind: IntakeAnswer["kind"]; text: string }[];
    const topic =
      requirements.topic.value ||
      requirements.promptQuestion.value ||
      "this assignment";
    const plan: { id: string; kind: IntakeAnswer["kind"]; text: string }[] = [];
    const northstar = Boolean(brief?.northstar);
    const has = (id: string) => answers.some((a) => a.questionId === id && a.answerText.trim());
    // A prepared student who already said what they think (QA 6:03 AM): no hobby, story or APA-comfort detour.
    const materialSaid = answers.find((a) => a.questionId === "material_check")?.answerText ?? "";
    const stated = brief?.decision?.source === "stated";
    const prepared = northstar && (stated || (Boolean(materialSaid) && isPreparedSaying(materialSaid) && !materialLost(materialSaid)));
    // QA 11:40 #4: no question points at material they haven't read and haven't been caught up on.
    const unread = northstar && !prepared && !caughtUp;
    const clean = (t: string) => (unread ? scrubUnreadRefs(t) : t);
    // QA 7:02 AM: "skip the get-to-know-you questions" skips all of them (never the gate steps).
    const getToKnowOff = skippedInterest && northstar;
    if (northstar) {
      // Meet them where they are (Colton t161u): the material first, then a real decision.
      // Already shown before the confirm (QA 7:02 AM): never re-ask "have you read it yet?".
      if (!brief?.materialShown || has("material_check")) plan.push({
          id: "material_check",
          kind: "background",
          // Colton 12:08: diagnose first. What's really asked, in plain words, then where they are.
          text: answers.find((a) => a.questionId === "material_check")?.questionText || diagnoseQuestion(brief?.readback?.ask || requirements.promptQuestion.value || requirements.topic.value),
        });
      // Their stated stance is the decision: never re-asked, only its reason when it's missing.
      if (!stated || has("decision_pick")) {
        plan.push({
          id: "decision_pick",
          kind: "coaching",
          text: brief?.options?.options.length
            ? clean(decisionQuestion(brief.options, { prepared, ask: brief.readback?.ask ?? requirements?.promptQuestion.value }))
            : [requirements.promptQuestion.value, brief?.readback?.ask, requirements.topic.value]
                .map((t) => (t ? assignmentDecisionAsk(t) : null))
                .find(Boolean) ??
              "Let's start small: what's your gut answer to the assignment's question right now, even a guess? One sentence and one reason is plenty.",
        });
      }
      const pickSaid = answers.find((a) => a.questionId === "decision_pick")?.answerText ?? "";
      const shortPick = Boolean(pickSaid.trim()) && !isSkipSaying(pickSaid) && wordCount(pickSaid) < 15;
      // QA 10:21 walk C: a long pick with no reason ("I read both… I want to argue transformational,
      // using Satya Nadella") still needs its why, or the gate can never pass.
      const noReason = Boolean(pickSaid.trim()) && !isSkipSaying(pickSaid) && !decisionHasReason(pickSaid);
      // QA 11:08 (Walton): a pick that already carries a real reason is never asked "say a bit more about why".
      if (!stated && (has("decision_why") || ((shortPick || noReason) && !isSolidReason(pickSaid)))) {
        plan.push({
          id: "decision_why",
          kind: "coaching",
          text: decisionHasReason(pickSaid)
            ? "Say a bit more about why that one. What would it let you show in your paper?"
            : "What's your main reason for that pick? One or two sentences is plenty.",
        });
      }
      // Colton 12:08 (INFORMED): what they gave is locked in; no re-ask for its reason here. The
      // early take (the next requirement) carries the why; the gate recovery still asks if it never comes.
      // QA 3:00 BLOCKER: the gate found no reason behind a locked-in pick: Pau asks for it in the chat.
      if (stated && !has("decision_why") && needWhy) {
        plan.push({
          id: "decision_why",
          kind: "coaching",
          text: "One thing before the stance interview: what's your main reason that's the right call for this assignment? One or two sentences is plenty.",
        });
      }
      if (stated && has("decision_why")) {
        // Once answered, the question stays as it was asked (the decision now carries the reason too).
        const askedWhy = answers.find((a) => a.questionId === "decision_why")?.questionText;
        if (askedWhy) plan.push({ id: "decision_why", kind: "coaching", text: askedWhy });
        else plan.push({
          id: "decision_why",
          kind: "coaching",
          text: `Got it, you're going with ${clipWords(
            (brief?.decision?.answer ?? "")
              // "I read both… I want to argue X": only the stance part is read back (QA 10:21 suite).
              .replace(/^[\s\S]*?(?=\b(?:i (?:want|plan|intend) to|i'?m going (?:to|with)|i'?d (?:argue|go with|pick)|my (?:pick|stance|choice) is)\b)/i, "")
              .replace(/^\s*(?:i'?m|i am)?\s*(?:going with|go with|i'?ll go with|picking|leaning toward|arguing for|my (?:pick|stance|choice) is|i (?:pick|chose|choose|picked)|i (?:want|plan|intend) to (?:argue(?: for| that)?|use|go with|write about|focus on)|i'?m going to (?:argue(?: for| that)?|use|go with|write about|focus on)|i'?d (?:argue(?: for)?|go with|pick|choose|use))\s*:?\s*/i, "")
              .replace(/[.!?\s]+$/, ""),
            160,
          )}. ${decisionHasReason(brief?.decision?.answer ?? "") ? "Say a bit more about why: what would it let you show in your paper?" : "What's your main reason? One or two sentences is plenty."}`,
        });
      }
      // The assignment needs one real person: a leader choice grounded in the readings.
      const people = brief?.options?.people ?? [];
      const leaderStated = brief?.leader?.question === "stated";
      if (people.length >= 2 && (!leaderStated || has("leader_pick"))) {
        plan.push({
          id: "leader_pick",
          kind: "coaching",
          text: clean(`This one needs a real leader as your example. Who fits your pick best? ${people.slice(0, 3).map((p) => `${p.label} (${p.why.replace(/[.\s]+$/, "")})`).join("; ")}. Or name someone else, even a leader from your own life like a coach or a boss, and say why.`),
        });
      }
    }
    // Colton 11:41: no get-to-know-you questions on north-star papers, for any student
    // (hobbies, story/show/sport, APA comfort, the generic "seen it in real life"). Every early
    // question serves the assignment: read-back, catch-up, decision with its reason, early take.
    if (!northstar && !skippedInterest && !prepared) {
      INTEREST_Qs.forEach((q) =>
        plan.push({ id: q.id, kind: "interest", text: q.text }),
      );
    }
    if (!northstar && ((!prepared && !getToKnowOff) || has("bg_comfort")))
      plan.push({
        id: "bg_comfort",
        kind: "background",
        text: citationComfortQuestion(requirements),
      });
    // The plain read-back and their decision already cover this one on north-star papers.
    if (!northstar)
      plan.push({
        id: "coaching_take",
        kind: "coaching",
        text: "In your own words, what do you think this assignment wants you to figure out?",
      });
    if (!northstar && ((!getToKnowOff && !prepared) || has("personal_1"))) plan.push({
      id: "personal_1",
      kind: "personal",
      // QA 11/23: never paste the whole assignment clause into the template.
      text: brief?.options?.options.length
        ? `When have you seen ${brief.options.options.map((o) => o.label.replace(/[.!?]+$/, "")).slice(0, 3).join(", ")} (or something like them) in real life — a coach, a boss, a teacher, a team, or something you follow? Write at least a few sentences.`
        : isQuestionTopic(topic) || /^(which|what|how|why|whether|who)\b/i.test(topic.trim())
          ? `When has the big question in this assignment come up in your own life — school, work, family, or something you follow? Write at least a few sentences.`
          : topic.split(/\s+/).length > 8
            ? `When have you seen the idea behind this assignment show up in real life — school, work, family, or something you follow? Write at least a few sentences.`
            : `When have you seen an idea like ${topicMidSentence(topic)} show up in real life — school, work, family, or something you follow? Write at least a few sentences.`,
    });
    // Early stance is asked after Pick your story (3.4a → stance on the angle).
    if (!northstar && needFallback && ((!getToKnowOff && !prepared) || has("fallback_voice"))) {
      plan.push({
        id: "fallback_voice",
        kind: "fallback_voice",
        text: "Before we start the stance interview, write a little more in your own words — no editing. Why does this assignment matter to you, or what's a moment when you saw this idea in real life?",
      });
    }
    return plan;
  }, [requirements, skippedInterest, needFallback, briefLoaded, brief?.northstar, brief?.northstarSet, northstarWaitOver, brief?.options, brief?.decision, brief?.leader, answers, caughtUp, needWhy]);
  // Prepared or get-to-know-skipped north-star students never get the extra voice question
  // (the plan leaves it out), so nothing may wait on it (QA 7:02 AM walk: a blank screen after the reason).
  // QA 10:21 walk C (root cause of the hang): the plan can shrink under the current index
  // (a leader named in the pick lands a moment later and leader_pick drops out), leaving
  // coachingPlan[qIndex] empty: no question, no reply, nothing to send. Track the question by id.
  const curQId = useRef<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  // North star (Colton 11:41): there is no extra voice question at all.
  const fallbackOff = Boolean(brief?.northstar);

  useEffect(() => {
    if (demoMode || resumedIntake.current || coachingPlan.length === 0) return;
    if (answers.length === 0 && !storyAngle && !pendingQuestion.current) {
      if (resumeReady) setResumePending(false);
      return;
    }
    // needFallback is not saved; a reload must rebuild the plan with the
    // fallback question before resuming, whether it was answered or was the
    // question being typed when the page reloaded.
    if (
      !needFallback &&
      (pendingQuestion.current === "fallback_voice" ||
        answers.some((answer) => answer.questionId === "fallback_voice"))
    ) {
      setNeedFallback(true);
      return;
    }
    // Same for a skipped get-to-know-you: rebuild the shorter plan first, so
    // the question index points into the plan that is actually shown.
    if (!skippedInterest) {
      const preview = resumeIntake(
        coachingPlan.map((question) => question.id),
        answers.map((answer) => answer.questionId),
      );
      if (preview.skipInterest) {
        setSkippedInterest(true);
        return;
      }
    }
    resumedIntake.current = true;
    // However the resume lands, the restore is settled after this pass.
    const settleRestore = () => {
      const restore = draftRestore.current;
      if (!restore || restore.opened) return;
      restore.opened = true;
      if (restore.serverDone) setRestoringDraft(false);
    };
    setResumePending(false);
    const resume = resumeIntake(
      coachingPlan.map((question) => question.id),
      answers.map((answer) => answer.questionId),
    );
    if (resume.skipInterest) setSkippedInterest(true);
    if (resume.screen === "gate") {
      settleRestore();
      setScreen("gate");
      return;
    }
    if (resume.screen === "coaching" || pendingQuestion.current) {
      const asked = pendingQuestion.current || new URLSearchParams(window.location.search).get("question");
      const askedIndex = asked ? coachingPlan.findIndex((question) => question.id === asked) : -1;
      const index = askedIndex >= 0 ? askedIndex : resume.index;
      const askedQuestion = askedIndex >= 0 ? coachingPlan[askedIndex] : null;
      const askedDone = askedQuestion
        ? answers.some((answer) => answer.questionId === askedQuestion.id)
        : false;
      const allAnswered = coachingPlan
        .filter((question) => !(resume.skipInterest && question.kind === "interest"))
        .every((question) => answers.some((answer) => answer.questionId === question.id));
      // Every intake question answered: reopen Pick your story (or the early
      // stance if a story is already picked) instead of a blank "Loading…" step.
      if (allAnswered && (askedIndex < 0 || askedDone)) {
        settleRestore();
        if (storyAngle) goToStanceOnStory();
        else finishCoaching(answers);
        return;
      }
      // The reopened question is already answered (a reload right after Send,
      // before the server had the next position): move on, as the chat did,
      // instead of asking it again. Skipped questions stay skipped.
      if (askedDone && askedIndex >= 0) {
        let next = askedIndex + 1;
        while (next < coachingPlan.length && answers.some((answer) => answer.questionId === coachingPlan[next]?.id)) next++;
        if (next >= coachingPlan.length) {
          settleRestore();
          const voice = evaluateStage1VoiceMinimum({
            answers: answers.map((a) => ({ text: a.answerText, isVoiceSample: a.isVoiceSample, kind: a.kind, pasteRatio: a.pasteRatio })),
          });
          if (voice.needsFallback && !fallbackOff && !needFallback && !answers.some((a) => a.kind === "fallback_voice") && !storyAngle) {
            setNeedFallback(true);
            setQIndex(coachingPlan.length);
            setScreen("coaching");
            return;
          }
          if (storyAngle) goToStanceOnStory();
          else finishCoaching(answers);
          return;
        }
        settleRestore();
        setQIndex(next);
        setScreen("coaching");
        setDraftAnswer("");
        return;
      }
      setQIndex(index);
      setScreen("coaching");
      const restore = draftRestore.current;
      if (restore && !restore.opened && coachingPlan[index]?.id === restore.questionId && restore.text) {
        // Prefill once, and never over words already in the box (QA 5:44 PM).
        const text = restore.text;
        setDraftAnswer((current) => (current.trim() ? current : text));
      }
    }
    settleRestore();
  }, [demoMode, answers, coachingPlan, storyAngle, needFallback, fallbackOff, skippedInterest, resumeReady]);

  const draftQuestionId = coachingPlan[qIndex]?.id ?? (qIndex < 0 ? "stance_early" : "draft");
  const draftStatus = useDraftSave({
    paperId,
    fieldKey: `stage1:${draftQuestionId}`,
    text: draftAnswer,
    enabled: !demoMode && screen === "coaching" && !restoringDraft,
    resume: draftPointer({ stage: 1, questionId: draftQuestionId }),
    localCopy: true,
  });

  const voiceEval = useMemo(() => {
    const latest = new Map<string, (typeof answers)[number]>();
    for (const answer of answers) {
      if (!answer.isVoiceSample || !answer.answerText.trim()) continue;
      latest.set(answer.questionId, answer);
    }
    const voiceAnswers: VoiceAnswer[] = [...latest.values()].map((answer) => ({
      text: answer.answerText,
      isVoiceSample: true,
      kind: answer.kind,
      pasteRatio: answer.pasteRatio,
    }));
    const evaluated = evaluateStage1VoiceMinimum({ answers: voiceAnswers });
    return {
      ...evaluated,
      totalWords: tallyVoiceWords(
        [...latest.values()].map((answer) => ({
          questionId: answer.questionId,
          text: answer.answerText,
          isVoiceSample: true,
        })),
      ),
    };
  }, [answers]);

  // Coming back to a conversation with turns: one welcome-back line, decided
  // once when the restore settles (Colton 3:46 PM). Nothing old is re-run.
  // PC-28 (Colton t185u): a return with history opens a clean chat: one welcome line naming the
  // last thing finished and what's next, then the exact question they were on. Nothing is lost:
  // the earlier chat is saved and one tap away ("Past chat"); every gate still reads saved state.
  const focus = useFocusReturn(
    paperId,
    !resumePending && confirmReady,
    screen !== "upload" || Boolean(sentMessage) || answers.length > 0 || confirmTurns.length > 0,
    stage1Fill(screen, qIndex),
  );
  const welcomeLine = focus.line;
  const [panel, setPanel] = useState<"skeleton" | "past" | null>(null);
  // What was already on screen when the clean chat opened: hidden from the active chat.
  const focusSnap = useRef<{ confirm: number; answered: Set<string>; story: boolean; asides: Set<number>; gateSaid: number } | null>(null);
  if (focus.focused && !focusSnap.current) {
    focusSnap.current = {
      confirm: confirmTurns.length,
      answered: new Set(answers.filter((a) => a.answerText.trim()).map((a) => a.questionId)),
      story: Boolean(storyAngle),
      asides: new Set(qaAsides.map((a) => a.id)),
      gateSaid: gateSaid.length,
    };
  }
  const snap = focus.focused ? focusSnap.current : null;
  const skeletonView = useSkeleton(paperId, { enabled: checklistConfirmed, fallbackText: rawText, refreshKey: `${brief?.decision?.answer ?? ""}|${brief?.leader?.answer ?? ""}` });
  const focusTools = (
    <>
      <FocusBar onSkeleton={() => setPanel("skeleton")} onPast={() => setPanel("past")} hasPast={Boolean(sentMessage) || confirmTurns.length > 0 || answers.length > 0} />
      {panel === "skeleton" ? (
        <SkeletonPanel
          view={skeletonView}
          words={{}}
          direction={brief?.decision?.answer ?? null}
          onClose={() => setPanel(null)}
          waiting={
            // QA 11:08 minor: "Building" the moment they confirm, not after the confirm round trip.
            checklistConfirmed || confirming
              ? "Building your skeleton…"
              : rawText.trim() || sentMessage
                ? "Reading your assignment. Your skeleton starts building the moment you confirm the details."
                : "Share your assignment and I'll sketch your skeleton right away."
          }
        />
      ) : null}
      {panel === "past" ? <PastChatPanel lines={stage1PastLines()} onClose={() => setPanel(null)} /> : null}
    </>
  );
  // Round 4 #3: Past chat is a recording of the bubbles as they rendered (lib/chat/turn-recorder).
  function stage1PastLines(): PastLine[] {
    return recordedPast;
  }
  const savedPastLoaded = useRef(false);
  useEffect(() => {
    if (demoMode || !paperId) return;
    let cancelled = false;
    fetch(`/api/papers/${paperId}/autosave`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { drafts?: { fieldKey?: string; text?: string }[] } | null) => {
        if (cancelled) return;
        setSavedPast(parsePastLines(data?.drafts?.find((d) => d.fieldKey === STAGE1_PAST_KEY)?.text));
        savedPastLoaded.current = true;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [demoMode, paperId]);
  const pastJson = !demoMode && resumeReady && recordedPast.length > 1 ? JSON.stringify(recordedPast.slice(-300).map((l) => ({ ...l, text: l.text.slice(0, 2000) }))) : "";
  const pastSent = useRef("");
  useEffect(() => {
    if (!pastJson || !savedPastLoaded.current || pastJson === pastSent.current || pastJson.length > 49_000) return;
    const t = window.setTimeout(() => {
      pastSent.current = pastJson;
      void persistField(paperId, { fieldKey: STAGE1_PAST_KEY, text: pastJson });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [pastJson, paperId]);
  const earlyStance = answers.find((a) => a.questionId === "stance_early");
  const stanceOk = earlyStance ? wordCount(earlyStance.answerText) >= 25 : false;
  const cardGate = { ok: checklistConfirmed };
  // North star: clarify (read-back) + catch up (offered or declined) + decide (direction with a reason).
  const lockedInStance =
    brief?.northstar && !answers.some((a) => a.questionId === "decision_pick")
      ? informedSaying(answers.find((a) => a.questionId === "material_check")?.answerText ?? "", brief.options?.options ?? [])?.stance ?? null
      : null;
  const northstarGate = brief?.northstar
    ? northstarGateFrom({
        answers,
        // QA 3:00 BLOCKER: the informed lock-in on screen and the gate read the same decision.
        decisionAnswer: brief.decision?.answer || lockedInStance || null,
        needsLeader: (brief.options?.people?.length ?? 0) >= 2,
        leaderAnswer: brief.leader?.answer ?? null,
        materialShown: Boolean(brief.materialShown),
      })
    : undefined;

  // QA 10:21 walk C: keep the question on screen when the plan changes under it.
  const planKey = coachingPlan.map((x) => x.id).join(",");
  const lastPlanKey = useRef("");
  useEffect(() => {
    const prev = lastPlanKey.current;
    lastPlanKey.current = planKey;
    if (screen !== "coaching" || qIndex < 0 || editReturn !== null || !planKey) return;
    const here = coachingPlan[qIndex];
    const want = curQId.current;
    if (!prev || prev === planKey || !want) {
      if (here) curQId.current = here.id;
      return;
    }
    if (here?.id === want) return;
    // Only a question that DROPPED out of the plan moves them (a plan that grew, e.g. the
    // north-star steps arriving ahead of the hobby questions, keeps the index as it was).
    const at = coachingPlan.findIndex((x) => x.id === want);
    if (at >= 0 || (here && answers.some((a) => a.questionId === want))) {
      if (here) curQId.current = here.id;
      else if (at >= 0) setQIndex(at);
      return;
    }
    // The question it was on dropped out (already answered by an earlier message): the next open one.
    const next = coachingPlan.findIndex((x) => !answers.some((a) => a.questionId === x.id));
    if (next >= 0) {
      curQId.current = coachingPlan[next].id;
      setQIndex(next);
      return;
    }
    if (needFallback) return;
    curQId.current = null;
    if (storyAngle) goToStanceOnStory();
    else finishCoaching(answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, qIndex, screen]);
  // A plain empty step (index past the plan, nothing pending) never strands them either.
  useEffect(() => {
    if (screen !== "coaching" || qIndex < 0 || editReturn !== null || !planKey || needFallback) return;
    if (coachingPlan[qIndex]) { curQId.current = coachingPlan[qIndex].id; return; }
    const t = setTimeout(() => {
      const next = coachingPlan.findIndex((x) => !answers.some((a) => a.questionId === x.id));
      if (next >= 0) setQIndex(next);
      else if (storyAngle) goToStanceOnStory();
      else finishCoaching(answers);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, qIndex, screen, needFallback]);
  // Server-side recovery (QA 10:21): a gate that can't pass on the decision re-asks it, with the
  // composer, instead of a disabled Start and no way forward. `forceRecover` is set when the
  // server's /intake/complete says the decision is missing.
  const [forceRecover, setForceRecover] = useState<string | null>(null);
  useEffect(() => {
    if (screen !== "gate" || !northstarGate || !briefLoaded || startingStance) return;
    if (northstarGate.decided && !forceRecover) return;
    const open = (id: string) => !answers.some((a) => a.questionId === id && a.answerText.trim());
    const ids = forceRecover ? [forceRecover, "decision_why", "decision_pick"] : ["decision_pick", "decision_why", "leader_pick"];
    let target = coachingPlan.findIndex((x) => ids.includes(x.id) && open(x.id));
    if (target < 0) for (const id of ids) { target = coachingPlan.findIndex((x) => x.id === id); if (target >= 0) break; }
    setForceRecover(null);
    // An informed lock-in has no decision questions in its plan: add the "why" so Pau asks in the chat.
    if (target < 0 && !needWhy) {
      setNeedWhy(true);
      return;
    }
    if (target < 0) return;
    setEditReturn({ at: "gate", draft: "" });
    setRecovering(true);
    curQId.current = coachingPlan[target].id;
    setDraftAnswer("");
    setQIndex(target);
    setScreen("coaching");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, northstarGate?.decided, briefLoaded, forceRecover, planKey]);

  // Step 4: read-aloud and hesitation help (both optional, saved per user).
  useStopSpeechOnUnmount();
  const chatPrefs = useChatPrefs();
  // Spark exchanges by question id, kept for this user + paper so they stay in
  // the thread and each question is offered at most once (also after reload).
  const [sparks, setSparks] = useState<Record<string, SparkTurn>>({});
  const sparksRef = useRef(sparks);
  useEffect(() => {
    const loaded = loadSparks(paperId);
    sparksRef.current = loaded;
    setSparks(loaded);
  }, [paperId]);
  const updateSpark = (qid: string, turn: SparkTurn) => {
    const next = { ...sparksRef.current, [qid]: turn };
    sparksRef.current = next;
    setSparks(next);
    saveSparks(paperId, next);
  };
  const hesitationKey =
    screen === "coaching" && editReturn === null
      ? qIndex < 0
        ? "stance_early"
        : coachingPlan[qIndex] && coachingPlan[qIndex].kind !== "background"
          ? coachingPlan[qIndex].id
          : null
      : null;
  useHesitation({
    questionKey: hesitationKey,
    text: draftAnswer,
    enabled:
      Boolean(hesitationKey) && !submitting && !chatPrefs.sparkOff && !(hesitationKey && sparks[hesitationKey]),
    onHesitate: (key) => {
      if (sparksRef.current[key] || chatPrefs.sparkOff) return;
      updateSpark(key, { status: "offer" });
    },
  });

  // Grok Voice on Stage 1 (Colton t159u): the same relay as Stage 2, only while
  // the paper is in Stage 1. Spoken words go through the typed paths (same
  // checks, same strict yes); her "move on" (submit_answer) sends the box as is.
  const rtFlag = useRealtimeFlag(paperId);
  const rtMode = rtFlag === true && !demoMode && accountPaper?.current_stage === 1;
  // The old read-aloud switch ("Voice off") never shows while Grok Voice may be the voice path.
  const hideReadAloud = rtMode || (rtFlag !== false && !demoMode);
  const voiceRef = useRef<(text: string, kind?: string) => Promise<string>>(async () => "ignored");
  const draftRef = useRef(draftAnswer);
  const storyRef = useRef(ownStory);
  const confirmSendRef = useRef<((text: string) => Promise<void>) | null>(null);
  const rt = useRealtimeCall({
    paperId,
    stage: 1,
    saveNote: async (text, kind) => {
      const result = await voiceRef.current(text, kind);
      // No prompt rides back with the tool result: the pacer says the next one once it settles.
      return { ok: true, result, screen: rtScreenRef.current.text };
    },
    welcome: () => ({
      welcome: Boolean(welcomeLine),
      index: focus.index,
      text: welcomeLine,
    }),
  });
  const rtQuestion =
    screen !== "coaching"
      ? null
      : qIndex < 0
        ? earlyStanceQuestion({ topic: requirements?.topic.value, promptQuestion: requirements?.promptQuestion.value })
        : (coachingPlan[qIndex]?.text ?? null);
  const lastPauTurn = [...confirmTurns].reverse().find((t) => t.role === "pau") as { paras: string[] } | undefined;
  // North star: the key points (and an honest ask for a missing reading) ride with the next question.
  const curId = screen === "coaching" && qIndex >= 0 ? coachingPlan[qIndex]?.id : undefined;
  const lostNow = Boolean(brief?.lostAtStart);
  const spokenAll = brief ? (brief.summaries?.length ? brief.summaries : brief.summary ? [brief.summary] : []).map(summarySpoken).join(" ") : "";
  const teachFirst =
    curId && brief
      ? reoffer === curId && spokenAll
        ? `They said they're lost again. First share these key points again, plainly, saying where each comes from (teaching content, never their paper text): ${spokenAll}. Then ask again: `
        : curId === "decision_pick" && lostNow && (spokenAll || brief.missingAsk)
          ? `${spokenAll ? `First, the key points, saying where each comes from (teaching content, never their paper text): ${spokenAll}. ` : ""}${brief.missingAsk ? `Then say honestly and warmly, in your own words: ${brief.missingAsk} ` : ""}Then the question on screen: `
          : ""
      : "";
  // PC-29 QA round 2: the same teaching, as words she says verbatim before the question.
  const teachSpoken =
    curId && brief
      ? reoffer === curId && spokenAll
        ? `No worries. Here's what I've got again. ${spokenAll}`
        : curId === "decision_pick" && lostNow && (spokenAll || brief.missingAsk)
          ? [spokenAll, brief.missingAsk ?? ""].filter(Boolean).join(" ")
          : ""
      : "";
  const rtView0 = stage1VoiceScreen({
    screen,
    qIndex,
    question: rtQuestion ? `${teachFirst}${rtQuestion}` : rtQuestion,
    lastPau: lastPauTurn?.paras ?? [],
    turns: confirmTurns.length,
    angles: storyAngles.map((a) => a.question),
    editing: editReturn !== null || editingDetails,
    error,
    greeting: `${ASSIGNMENT_GREETING} ${ASSIGNMENT_ASK}`,
    ask: rtQuestion,
    teach: teachSpoken,
  });
  const rtDetail = Boolean(teachFirst) || (screen === "card" && confirmTurns.length <= 1);
  const rtView = { ...rtView0, key: `${rtView0.key}${teachFirst ? `:t${brief?.summary ? 1 : 0}${brief?.missingAsk ? 1 : 0}${reoffer ?? ""}` : ""}` };
  const rtScreenRef = useRef(rtView);
  const confirmTurnsRef = useRef(confirmTurns);
  confirmTurnsRef.current = confirmTurns;
  const rtDetailRef = useRef(rtDetail);
  rtDetailRef.current = rtDetail;
  // PC-29 QA round 2: the on-screen prompt exactly as shown (the turn branches below refine it
  // during render with the copy they actually display); the call says it word for word.
  const voiceLineRef = useRef("");
  voiceLineRef.current = rtView.spoken;
  useEffect(() => {
    rtScreenRef.current = rtView;
    draftRef.current = draftAnswer;
    storyRef.current = ownStory;
  });
  // Spoken words on each screen go through the same handlers as typing.
  useEffect(() => {
    voiceRef.current = async (text, kind) => {
      const before = rtScreenRef.current.key;
      // The next step renders a beat after the save resolves: poll briefly instead of a fixed wait.
      const moved = async () => {
        for (let i = 0; i < 20; i++) {
          if (rtScreenRef.current.key !== before) return "saved";
          await new Promise((r) => setTimeout(r, 50));
        }
        return "needs_more";
      };
      if (kind === "submit") {
        if (screen === "coaching") {
          const box = draftRef.current.trim();
          const q = coachingPlan[qIndex];
          if (!box && (qIndex < 0 || (q && q.kind !== "background"))) return "empty";
          if (submitting) return "busy";
          setSubmitting(true);
          try {
            await (qIndex < 0 ? submitStanceAnswer(box) : submitAnswer({ text: box }));
          } finally {
            setSubmitting(false);
          }
          return moved();
        }
        if (screen === "story") {
          const box = storyRef.current.trim();
          if (!box) return "empty";
          await submitOwnStory(box);
          return moved();
        }
        // Read-back / checklist: their spoken reply is already on its way through the
        // typed path; report whether the app moved on rather than a stale "nothing".
        for (let i = 0; i < 15; i++) {
          if (rtScreenRef.current.key !== before) return "saved";
          await new Promise((r) => setTimeout(r, 200));
        }
        return "nothing_to_submit";
      }
      if ((screen === "coaching" || screen === "story") && isControlPhrase(text)) return "move_on_words";
      const qNow = screen === "coaching" ? coachingPlan[qIndex] : undefined;
      // "Have you read it?": whatever they say is their answer (lost or not), word for word.
      if (qNow?.id === "material_check") {
        draftRef.current = appendSpoken(draftRef.current, text);
        setDraftAnswer(draftRef.current);
        setError(null);
        return "in_box";
      }
      const b = briefRef.current;
      // Lost again: the key points come back; nothing goes in the box.
      if (qNow && qNow.kind === "coaching" && b?.summary && text.length <= 160 && isLostSaying(text)) {
        setReoffer(qNow.id);
        return "offered_summary";
      }
      // Her own summary heard back (echo or parroting) is never their answer.
      if (qNow && b && overlapsTeaching(text, { v: 1, readback: b.readback ?? undefined, summaries: b.summary ? [b.summary] : undefined })) return "echo_of_summary";
      // Requests to Pau are answered by her, never saved as their answer (or voice sample).
      if ((screen === "coaching" || screen === "story") && isSaidToCoach(text)) return "said_to_coach";
      if (screen === "coaching") {
        // The ref first: her move-on can arrive before the next render.
        draftRef.current = appendSpoken(draftRef.current, text);
        setDraftAnswer(draftRef.current);
        setError(null);
        return "in_box";
      }
      if (screen === "story") {
        storyRef.current = appendSpoken(storyRef.current, text);
        setOwnStory(storyRef.current);
        setError(null);
        return "in_box";
      }
      if (screen === "card" && confirmSendRef.current) {
        await confirmSendRef.current(text);
        return "sent_to_readback";
      }
      if (screen === "gate") {
        // The same strict yes as typing; anything else is just talk.
        const blocked = stanceStartBlockers({
          northstar: northstarGate,
          checklistConfirmed: cardGate.ok,
          hasStory: Boolean(storyAngle),
          voiceOk: voiceEval.ok,
          voiceReason: voiceEval.reasons[0],
          stanceOk,
        });
        if (!isQuickConfirm(text) || blocked.length > 0) return "aside";
        await completeStage1();
        return "starting_stage2";
      }
      return "ignored";
    };
  });
  // PC-29 QA round 3: every render (the coaching branch below refines voiceLineRef during render),
  // the pacer decides what the relay may treat as on screen and when the call says it. It is the
  // ONLY source of Stage 1 prompts: one settled line, never a branch the plan is about to drop.
  const pacer = useRef(new Stage1VoicePacer());
  const paceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenSent = useRef<string | null>(null);
  const paceRef = useRef<() => void>(() => undefined);
  const rtOn = rt.on;
  useEffect(() => {
    paceRef.current = () => {
      if (paceTimer.current) clearTimeout(paceTimer.current);
      paceTimer.current = null;
      if (!rtOn) {
        pacer.current.reset();
        screenSent.current = null;
        return;
      }
      const view = rtScreenRef.current;
      const hold = view.key.startsWith("card:") && confirmTurnsRef.current[confirmTurnsRef.current.length - 1]?.role !== "pau";
      // Steer (QA round 4): a plan item that never renders (the hobby prompt) is never spoken.
      const hidden = !questionsRendered(voiceLineRef.current, document.querySelector("main")?.textContent ?? document.body.textContent ?? "");
      const pace = pacer.current.step({ key: view.key, line: voiceLineRef.current, now: Date.now(), busy: briefPending.current > 0, hold, hidden });
      const sig = JSON.stringify([view.text, view.choices, pace.spoken]);
      if (sig !== screenSent.current) {
        screenSent.current = sig;
        rt.setScreen(view.text, view.choices, false, pace.spoken);
      }
      if (pace.say) {
        rt.clearLive();
        rt.sayTurn(view.text, { detail: rtDetailRef.current, spoken: pace.say });
      }
      if (pace.wakeIn !== null) paceTimer.current = setTimeout(() => paceRef.current(), pace.wakeIn);
    };
    paceRef.current();
  });
  useEffect(() => () => {
    if (paceTimer.current) clearTimeout(paceTimer.current);
  }, []);
  // PC-29: the assignment is pasted or typed, never spoken: focusing the box pauses the mic.
  const typedPrompt = rt.on && screen === "upload";
  useEffect(() => {
    typingArbiter.setTypedPrompt(typedPrompt);
    return () => typingArbiter.setTypedPrompt(false);
  }, [typedPrompt]);

  // Nothing (no intro, no prefill, no speech) until the restore completes,
  // including the saved read-back turns (QA 5:44 PM).
  if (!paper || resumePending || !confirmReady) {
    return (
      <div className="mx-auto max-w-2xl py-16" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-5 w-5 animate-spin rounded-full border-2 border-ds-border border-t-ds-ink"
          />
          <p className="text-[16px] leading-[1.6] text-ds-muted">
            {paper ? "Picking up where you left off…" : "Loading paper…"}
          </p>
        </div>
      </div>
    );
  }

  function openChecklist(next: AssignmentRequirements, corpus: string) {
    setRawText(corpus);
    setRequirements(next);
    setScreen("card");
  }

  async function retryFile(id: string) {
    const target = stagedFiles.find((f) => f.id === id);
    if (!target) return;
    setError(null);
    await extractStagedFile(paperId, id, target.file, setStagedFiles);
  }

  /** Back to the upload screen with an honest message; never an empty card. */
  function failRead(message: string) {
    setError(message);
    setScreen("upload");
  }

  async function runParse() {
    setError(null);
    const typed = paste.trim();
    const typedLinks = typed.match(/https?:\/\/[^\s<>"”)]+/g) ?? [];
    const linkList = [...new Set([...parseLinkField(links), ...typedLinks])];
    const hasFiles = stagedFiles.length > 0;
    if (hasFiles && !rightsOk) {
      setError("Tick the box to confirm you're uploading this for your own coursework.");
      return;
    }
    if (stagedFiles.some((f) => f.status === "reading")) {
      setError("Your files are still being read. Send unlocks when they finish.");
      return;
    }
    const fileTexts = stagedFiles
      .filter((f) => f.status === "ready")
      .map((f) => f.extractedText.trim())
      .filter(Boolean);
    const failedFiles = stagedFiles.filter((f) => f.status === "failed");
    if (failedFiles.length) {
      setError(
        failedFiles.length === 1
          ? `I couldn't read ${failedFiles[0]!.filename}. Retry it or remove it, then send again.`
          : "I couldn't read some of your files. Retry them or remove them, then send again.",
      );
      return;
    }
    if (!hasFiles && !typed && linkList.length === 0) {
      setError("Attach the assignment with +, or tell me about it in the box.");
      return;
    }
    // A described assignment needs a little to go on: the topic, the length, anything.
    if (!hasFiles && wordCount(typed.replace(/https?:\/\/\S+/g, "")) < 4 && !linkList.length) {
      setSentMessage({ text: typed, files: [], at: Date.now() });
      // It's in their bubble now; the box is for the next try.
      setPaste("");
      setError(
        "Tell me a little more: what's the topic or question, and how long should it be? You can also tap + to add the assignment sheet.",
      );
      return;
    }
    const message: SentMessage = {
      text: typed,
      files: stagedFiles.map((f) => ({ name: f.filename, kind: f.kind })),
      at: Date.now(),
    };
    setSentMessage(message);
    saveSentMessage(paperId, message);
    if (!demoMode) void persistField(paperId, { fieldKey: SENT_FIELD_KEY, text: JSON.stringify(trimSent(message)) });
    // Sent: the text is in the student's bubble, so the box clears (as in any chat).
    setPaste("");
    setParseStartedAt(Date.now());
    setScreen("parsing");
    setParseStatus(
      "Reading the assignment…",
    );

    if (typed || linkList.length) {
      void fetch(`/api/papers/${paperId}/assignment/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pasteText: typed || undefined,
          links: linkList.length ? linkList : undefined,
          extractionMethod: typed ? "paste" : "manual",
        }),
      }).catch(() => undefined);
    }
    if (!demoMode) void storeOriginals(paperId, stagedFiles);

    const combined = [
      ...fileTexts,
      typed,
      ...linkList.map((u) => `[Link provided]: ${u}`),
    ]
      .filter(Boolean)
      .join("\n\n");

    // SOP: coaching only, never generate submission text
    if (combined.trim()) {
      try {
        // Suite r25: under load a parse request could hang with no answer ("Still reading… 280s").
        // The server gives up by ~22 s, so a request with no answer by 35 s is retried once, then
        // the student gets the try-again message instead of an endless spinner.
        const askParse = async (): Promise<Response> => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 35_000);
          try {
            return await fetch(`/api/papers/${paperId}/assignment/parse`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ corpusText: combined, described: !hasFiles || undefined }),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timer);
          }
        };
        const res = await askParse().catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return askParse();
          throw e;
        });
        const data = (await res.json()) as {
          requirements?: AssignmentRequirements;
          rawText?: string;
          parseStatus?: string;
          needsConfirmation?: boolean;
          message?: string;
          error?: string;
          saved?: boolean;
        };
        if (!data.requirements || !requirementsHaveFacts(data.requirements)) {
          if (!demoMode || !res.ok) {
            failRead(
              data.message ??
                data.error ??
                "We read your file but couldn't find the assignment details in it. Check it's the assignment sheet, or add the text below.",
            );
            return;
          }
        } else if (data.needsConfirmation) {
          setError(data.message ?? UNREADABLE_ASSIGNMENT);
          openChecklist(data.requirements, data.rawText ?? combined);
          return;
        } else {
          if (data.error || data.saved === false) {
            setError(data.error ?? "We read the assignment but couldn't store it. Please try again.");
          }
          openChecklist(data.requirements, data.rawText ?? combined);
          return;
        }
      } catch {
        if (!demoMode) {
          failRead("We couldn't reach the server to read your assignment. Check your connection and try again.");
          return;
        }
      }
      const fallback = parseAssignmentFallback(combined, {
        allowTopicAndDueDateGuess: process.env.NODE_ENV !== "production",
      });
      if (!requirementsHaveFacts(fallback)) {
        failRead("We couldn't find the assignment details. Check it's the assignment sheet, or add the text below.");
        return;
      }
      openChecklist(fallback, combined);
      return;
    }

    // Links only: nothing to read yet, so the student fills the checklist.
    if (linkList.length && !hasFiles) {
      openChecklist(emptyRequirements(), "");
      return;
    }
    failRead("We couldn't find any text to read. Add a file or the assignment text.");
  }

  function updateField<K extends keyof AssignmentRequirements>(
    key: K,
    next: AssignmentRequirements[K],
  ) {
    setRequirements((prev) => (prev ? { ...prev, [key]: next } : prev));
    if (key === "topic" || key === "promptQuestion") {
      const value = (next as { value?: string | null }).value;
      if (typeof value === "string" && value.trim()) setError(null);
    }
  }

  async function confirmCard(opts?: { aiPolicyAck?: boolean }) {
    if (!requirements || confirming) return;
    const gate = assertAssignmentConfirmGate(requirements);
    if (!gate.ok) {
      setError(gate.reasons[0] ?? "Fix the citation style description first.");
      window.setTimeout(() => {
        document.getElementById("confirm-error")?.scrollIntoView({ block: "center" });
      }, 0);
      return;
    }
    const confirmed = gate.requirements;
    setError(null);

    if (
      !opts?.aiPolicyAck &&
      needsAiPolicyAck(confirmed, rawText) &&
      !aiPolicyAck
    ) {
      setScreen("ai_policy");
      return;
    }

    const ack = Boolean(opts?.aiPolicyAck || aiPolicyAck);
    if (ack) setAiPolicyAck(true);
    setConfirming(true);

    try {
      const res = await fetch(`/api/papers/${paperId}/assignment/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements: confirmed,
          aiPolicyAck: ack || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!demoMode) {
          setError(data.error ?? "We couldn't save this assignment. Please try again.");
          setConfirming(false);
          return;
        }
      }
    } catch {
      if (!demoMode) {
        setError("We couldn't save this assignment. Please try again.");
        setConfirming(false);
        return;
      }
    }

    setRequirements(confirmed);
    const nextPaper: DemoPaper = {
      ...paper!,
      title:
        paper!.title ||
        confirmed.topic.value ||
        confirmed.promptQuestion.value ||
        null,
      course: confirmed.course.value,
      due_date: confirmed.dueDate.value,
      assignment_prompt: rawText,
      required_length: formatLengthLabel(confirmed.length.value),
      citation_style:
        confirmed.citationStyle.value === "other"
          ? confirmed.citationStyleOther ?? "other"
          : confirmed.citationStyle.value,
    };
    upsertDemoPaper(nextPaper);
    setPaper(nextPaper);
    setChecklistConfirmed(true);
    // The confirmed read-back joins the paper context; the summary and options start loading now.
    // Options load right away too (QA 7:02 AM walk: with the catch-up already shown, nothing else asked for them).
    void briefCall({ action: "confirm_readback" }).then((v) => (v && !v.options ? briefCall({ action: "options" }) : null));
    setScreen("coaching");
    setQIndex(0);
    dropSent();
    pasteMeta.reset();
  }

  function skipInterest() {
    setSkippedInterest(true);
    setAnswers((prev) => answersAfterSkippingInterest(prev));
    dropSent();
    // North star (QA 7:02 AM): every get-to-know-you question goes, the gate steps stay.
    const getToKnow = new Set(brief?.northstar ? ["bg_comfort", "personal_1", "fallback_voice"] : []);
    const rest = coachingPlan.filter((question) => question.kind !== "interest" && !getToKnow.has(question.id));
    const answered = new Set(answers.map((answer) => answer.questionId));
    const next = rest.findIndex((question) => !answered.has(question.id));
    // Everything left was get-to-know-you (QA 7:02 AM walk): straight on, never back to question 1.
    if (next === -1) {
      finishCoaching(answersAfterSkippingInterest(answers));
      return;
    }
    setQIndex(next);
  }

  function finishCoaching(nextAnswers: IntakeAnswer[]) {
    // North star: their decision (their words, with their reason) IS the direction; no second angle picker.
    const said = (id: string) => nextAnswers.find((a) => a.questionId === id)?.answerText.trim() ?? "";
    // Their stated stance plus its reason (and leader) when they came in prepared.
    const why = said("decision_why");
    const dNow = (briefRef.current ?? brief)?.decision;
    // QA 1:16: the decision save can still be in flight here; their informed words are the direction either way.
    const informedNow = brief?.northstar && !said("decision_pick") ? informedSaying(said("material_check"), (briefRef.current ?? brief)?.options?.options ?? []) : null;
    const savedStated = dNow?.answer?.trim() && !said("decision_pick") ? dNow.answer.replace(/^[.\s]+/, "") : "";
    // A parsed pick can be shorter than what they wrote; their own full words win (QA 1:16: Walton got angle cards).
    const statedAnswer = informedNow?.stance && wordCount(informedNow.stance) > wordCount(savedStated) ? informedNow.stance : savedStated;
    const statedDecision = statedAnswer ? (why && !statedAnswer.includes(why) ? `${statedAnswer} ${why}` : statedAnswer) : "";
    const pickDecision = said("decision_pick") ? [said("decision_pick"), why].filter(Boolean).join(" ") : "";
    const leaderSaid = said("leader_pick");
    const decided = brief?.northstar
      ? [pickDecision || statedDecision, leaderSaid && !(pickDecision || statedDecision).includes(leaderSaid) ? leaderSaid : ""].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 500)
      : "";
    // (The server's story-pick gate needs 15+ words of their own; shorter picks still see the angle cards.)
    if (decided && !storyAngle && wordCount(decided) >= 15) {
      setStoryAngle({ text: decided, source: "student" });
      setStoryFromDecision(true);
      void fetch(`/api/papers/${paperId}/intake/story-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: decided, source: "student" }),
      }).catch(() => undefined);
      afterStoryPicked();
      return;
    }
    const phrases = nextAnswers
      .filter((a) => a.isVoiceSample && a.answerText.trim())
      .map((a) => a.answerText.trim());
    const topic =
      requirements?.topic.value ||
      requirements?.promptQuestion.value ||
      "this assignment";
    // North star: the cards build on their decision, never the prompt read back (QA 8:31 AM).
    const bd = (briefRef.current ?? brief)?.decision;
    const bl = (briefRef.current ?? brief)?.leader;
    const decisionFor = brief?.northstar && bd
      ? { pick: bd.pick !== "their own" ? bd.pick : styleWordFrom(bd.answer), leader: bl?.pick && bl.pick !== "their own" ? bl.pick : null }
      : null;
    const angles =
      storyAngles.length > 0
        ? storyAngles
        : buildStoryAngleFallback({ topic, studentPhrases: phrases, decision: decisionFor });
    setStoryAngles(angles);
    void fetch(`/api/papers/${paperId}/intake/story-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.slice(0, 500), studentPhrases: phrases.slice(0, 20).map((p) => p.slice(0, 400)), decision: decisionFor }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { angles?: StoryAngle[] };
        if (data.angles?.length) setStoryAngles(data.angles);
      })
      .catch(() => undefined);
    setScreen("story");
  }

  /** What Pau taught (summary + read-back): used to keep it out of their answers. */
  function teachCtx(): PaperContext {
    return {
      v: 1,
      readback: brief?.readback ?? undefined,
      summaries: brief?.summaries?.length ? brief.summaries : brief?.summary ? [brief.summary] : undefined,
    };
  }

  /** Her answer to a question asked mid-interview ("what does Notes on the Quiet Kitchen say?"). Never saved. */
  async function answerAside(qid: string, ask: string, said: string) {
    setAsideBusy("Digging it up…");
    let paras: string[] = [];
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(`/api/papers/${paperId}/coach/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "answer", message: said.slice(0, 2000), stage: 1, ask: ask.slice(0, 1000) }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const d = (await res.json().catch(() => null)) as { paras?: string[] } | null;
      paras = (d?.paras ?? []).map((p) => stripReadingRefusal(p)).filter(Boolean);
    } catch {
      paras = [];
    }
    setAsideBusy(null);
    if (!paras.length) paras = ["I couldn't pull that together just now. Ask me again in a sec, or add the reading and I'll work from it."];
    setQaAsides((prev) => [...prev, { id: Date.now(), qid, said, paras: [...paras, "Back to my question whenever you're ready."] }].slice(-12));
  }

  /** A pasted reading paragraph goes in as material, never as their answer or angle. */
  async function takePastedReading(qid: string, text: string) {
    const works = requirements ? namedWorksFrom(requirements, rawText) : [];
    const named = works
      .filter((w) => text.toLowerCase().includes((w.match(/[“"]([^”"]{4,90})[”"]/)?.[1] ?? w.replace(/\s+by\s+.*$/i, "")).toLowerCase().trim()))
      .map((w) => displayWork(w).replace(/[“”]/g, ""))[0];
    const missing = brief?.missing ?? [];
    const title = named ?? (missing.length === 1 ? missing[0]! : "Pasted reading");
    setAsideBusy("Reading it now…");
    const v = await briefCall({ action: "reading", title, text: text.slice(0, 200_000) });
    setAsideBusy(null);
    const s0 = v?.summaries?.find((x) => x.title === title) ?? [...(v?.summaries ?? [])].reverse().find((x) => x.kind === "reading") ?? null;
    setQaAsides((prev) =>
      [
        ...prev,
        {
          id: Date.now(),
          qid,
          said: `${text.split(/\s+/).slice(0, 18).join(" ")}…`,
          paras: pastedReadingParas({ title, summary: s0, text, tail: "Now, in your own words: what do you make of it?" }),
        },
      ].slice(-12),
    );
  }

  // QA 11:40 #2: the catch-up, offered after vague picks when they skipped it.
  async function catchUpNow(qid: string) {
    setCatchUpOffer(null);
    setAsideBusy("Digging it up… pulling together the key points.");
    setSummaryBusy(true);
    try {
      await briefCall({ action: "lost" });
      await briefCall({ action: "summary" });
      setCatchUpGiven(true);
      setReoffer(qid);
    } finally {
      setSummaryBusy(false);
      setAsideBusy(null);
    }
  }

  // QA 8:31 AM: "Digging it up…" renders in the same tick as send and stays until the answer is in.
  async function submitAnswer(opts0?: { skip?: boolean; text?: string }) {
    try {
      await submitAnswerNow(opts0);
    } finally {
      setAsideBusy(null);
    }
  }

  async function submitAnswerNow(opts0?: { skip?: boolean; text?: string }) {
    let opts = opts0;
    const q = coachingPlan[qIndex];
    if (!q) {
      if (qIndex >= coachingPlan.length && coachingPlan.length > 0) {
        if (storyAngle) goToStanceOnStory();
        else finishCoaching(answers);
      }
      return;
    }
    setShortEcho(null);
    if (q.id !== "material_check") setInformedLead(null);
    let typed = opts?.skip ? "" : (opts?.text ?? draftAnswer).trim();
    const sentBox = (opts?.text ?? draftAnswer).trim();
    let offerAnswered = false;
    // QA 7:02 AM: "skip the get-to-know-you questions" skips every one of them.
    if (typed && brief?.northstar && isGetToKnowSkip(typed)) {
      setError(null);
      skipInterest();
      return;
    }
    // Colton 1:54 R1: their answer to the summary offer. Lost again or yes: the short catch-up
    // (their first words are what's saved). No: straight on to choosing a direction.
    if (typed && q.id === "material_check" && catchUpOffer === q.id && brief?.northstar) {
      // QA 11:08 must-fix: the decline is read first. "No thanks, let's pick a direction" also reads as
      // unsure ("pick a direction"), which sent the full summary, a material request and the style question.
      const declined = !/catch me up|^\s*(yes|yeah|sure|ok(ay)?)\b/i.test(typed) && (isNoSaying(typed) || /\b(no thanks|skip|pick a direction|let'?s pick)\b/i.test(typed));
      if (!declined && (materialLost(typed) || isYesSaying(typed) || /catch me up|summar/i.test(typed))) {
        setCatchUpOffer(null);
        { const reply = typed; const qid = q.id; setOfferReply((p) => ({ ...p, [qid]: reply })); }
        typed = offerSaid.current ?? typed;
        offerAnswered = true;
      } else if (declined) {
        setCatchUpOffer(null);
        { const reply = typed; const qid = q.id; setOfferReply((p) => ({ ...p, [qid]: reply })); }
        typed = "No thanks, skip the summary. Let's pick a direction.";
        offerAnswered = true;
      }
    }
    // Colton 1:54 R1: lost the first time: offer the short summary (no lecture), one tap or a yes.
    if (
      typed &&
      !offerAnswered &&
      q.id === "material_check" &&
      brief?.northstar &&
      catchUpOffer !== q.id &&
      !(brief?.lostAtStart && brief?.summary) &&
      materialLost(typed) &&
      !/catch me up|summar/i.test(typed)
    ) {
      offerSaid.current = typed;
      setQaAsides((prev) => [...prev, { id: Date.now(), qid: q.id, said: typed, paras: [lostOffer(brief?.readback?.ask ?? requirements?.promptQuestion.value)] }].slice(-12));
      setCatchUpOffer(q.id);
      dropSent(sentBox);
      setError(null);
      return;
    }
    // QA 11:40 #1: a bare "sure" / "ok" to "Have you read it?" is ambiguous: offer the catch-up as a one-tap yes.
    if (typed && !offerAnswered && q.id === "material_check" && isAmbiguousReply(typed)) {
      setQaAsides((prev) => [
        ...prev,
        { id: Date.now(), qid: q.id, said: typed, paras: ["Just to check: want me to catch you up on the key points first? Tap “Yes, catch me up” and I'll pull them together. If you've already read it, tap “I've read it”."] },
      ].slice(-12));
      setCatchUpOffer(q.id);
      dropSent(sentBox);
      setError(null);
      return;
    }
    // A typed "skip" / "n/a" is a skip, never an answer; the gate steps still need their words.
    if (typed && !offerAnswered && isSkipSaying(typed)) {
      if (STAGE1_REQUIRED_QS.includes(q.id)) {
        setError("This one counts toward finishing Stage 1, so I need a few words of your own here, even rough ones.");
        return;
      }
      opts = { skip: true };
    }
    let text = opts?.skip ? "" : typed;
    // QA 1:11 AM #4: a non-answer ("first quick message") is never their answer or reason: a gentle re-ask.
    if (text && q.id !== "stance_early" && !recPending.current[q.id] && isFillerSaying(text)) {
      // QA 11:08: one gentle re-ask at most; after that a filler gets a quiet "no rush", never another question.
      const qid = q.id;
      setQaAsides((prev) => [...prev, { id: Date.now(), qid, said: text, paras: [prev.some((x) => x.qid === qid && x.filler) ? FILLER_AGAIN : fillerNudge(qid)], filler: true }].slice(-12));
      dropSent(sentBox);
      setError(null);
      return;
    }
    // QA 7:02 AM: a message that may need a lookup shows "Digging it up…" at send time.
    // The status shows even before the brief has loaded (QA 9:37 AM: "Digging it up…" at 4-5 s).
    const lookup = Boolean(text && !offerAnswered && (brief?.northstar ?? true) && mayNeedLookup(text));
    if (q?.id === "material_check" && text && materialLost(text)) setAsideBusy("Digging it up… pulling together the key points.");
    else if (lookup) setAsideBusy("Digging it up…");
    if (!opts?.skip && !text && q.kind !== "background") {
      setError("Tell me a little, even a sentence, or tap skip.");
      return;
    }
    // North star: these two need the student's own input (nothing advances without it).
    if ((q.id === "material_check" || q.id === "decision_pick") && (opts?.skip || !text)) {
      setError(q.id === "decision_pick" ? "Tell me which one you'd pick and why, even one sentence." : "Tell me a little, even a few words.");
      return;
    }
    // A pasted reading paragraph is material, never their answer, and wins over any pick or question parsing (QA 8:31 AM).
    if (!opts?.skip && text && brief?.northstar && looksLikePastedReading(text, pasteMeta.meta.pasteRatio)) {
      dropSent(sentBox);
      setError(null);
      pasteMeta.reset();
      await takePastedReading(q.id, text);
      return;
    }
    // A question about a reading or the topic gets an answer and is never saved (QA 6:03 AM).
    if (
      !opts?.skip &&
      text &&
      !offerAnswered &&
      brief?.northstar &&
      q.id !== "stance_early" &&
      !(q.id === "material_check" && materialLost(text)) &&
      (isReadingQuestion(text) || (isContentQuestion(text) && /\?\s*$/.test(text)))
    ) {
      dropSent(sentBox);
      setError(null);
      await answerAside(q.id, q.text, text);
      return;
    }
    // QA 11:40 #2/#3: a vague or confused pick. Round 1 names the options; from round 2 (or right away
    // when confused) she teaches the differences, recommends a starting point and asks yes or no plus why.
    // A yes to her recommendation is their pick; the same question is never sent twice in a row.
    let tookRec = false;
    if (q.id === "decision_pick" || q.id === "leader_pick") {
      const rec = recPending.current[q.id];
      if (rec && text && isYesSaying(text)) {
        const rest = text.replace(/^\s*(?:yes|yeah|yep|yup|sure|ok(?:ay)?|sounds good|let'?s do (?:it|that)|that works)[\s,.!-]*/i, "").trim();
        text = `I'd pick ${rec.label}${rest ? `. ${rest}` : ""}`;
        recPending.current[q.id] = null;
        tookRec = true;
      }
    }
    const confused = !tookRec && (q.id === "decision_pick" || q.id === "leader_pick") && Boolean(text) && isConfusedSaying(text) && !decisionHasReason(text);
    const vagueNo = !tookRec && Boolean(recPending.current[q.id]) && Boolean(text) && isNoSaying(text) && wordCount(text) < 6;
    if (
      !tookRec &&
      (q.id === "decision_pick" || q.id === "leader_pick") &&
      text &&
      (confused || vagueNo || (isVaguePick(text) && !decisionHasReason(text)))
    ) {
      const opts2 = q.id === "leader_pick" ? brief?.options?.people ?? [] : brief?.options?.options ?? [];
      const lean = confused || vagueNo ? null : guessPick(text, opts2);
      const round = (vagueRounds.current[q.id] = (vagueRounds.current[q.id] ?? 0) + 1);
      if (vagueNo) recNos.current[q.id] = (recNos.current[q.id] ?? 0) + 1;
      const unreadNow = Boolean(brief?.northstar) && !caughtUp && !isPreparedSaying(materialAnswerNow);
      const esc = lean && round <= 1
        ? { paras: [vaguePickProbe(text, opts2)], recommend: null, offerCatchUp: false }
        : pickEscalation({
            options: opts2,
            round: confused ? Math.max(2, round) : vagueNo ? Math.max(3, round) : round,
            confused,
            last: lastProbe.current[q.id] ?? null,
            unread: unreadNow,
            catchUpSkipped: unreadNow && !brief?.missing?.length,
            kind: q.id === "leader_pick" ? "leader" : "style",
            people: brief?.options?.people ?? [],
            recIndex: recNos.current[q.id] ?? 0,
            concept: brief?.options?.concept ?? null,
          });
      lastProbe.current[q.id] = esc.paras.join("\n");
      recPending.current[q.id] = esc.recommend;
      setCatchUpOffer(esc.offerCatchUp ? q.id : null);
      setQaAsides((prev) => [...prev, { id: Date.now(), qid: q.id, said: text, paras: esc.paras }].slice(-12));
      setBoxUnlessTyped(lean && round <= 1 ? `I'd pick ${lean.label} because ` : "", sentBox);
      setError(null);
      return;
    }
    if (q.id === "decision_pick" && !tookRec && wordCount(text) < 6) {
      setError("Tell me which one you'd pick and why, even one sentence.");
      return;
    }
    if (q.id === "decision_why" && (opts?.skip || !text)) {
      setError("Tell me your main reason, even one sentence.");
      return;
    }
    // Pau's summary is teaching content, never their answer.
    if (!opts?.skip && text && brief && overlapsTeaching(text, teachCtx())) {
      setError("That's my summary talking. Tell me in your own words, even roughly.");
      return;
    }
    // Lost again later on: the key points come back, nothing is saved.
    if (!opts?.skip && text && q.kind === "coaching" && text.length <= 160 && brief?.summary && isLostSaying(text)) {
      setReoffer(q.id);
      dropSent(sentBox);
      setError(null);
      return;
    }
    // QA 3:26 AM #4: filler on the early take gets its own nudge and never sticks to the take.
    if (!opts?.skip && q.id === "stance_early" && text && !withoutFiller(text)) {
      setShortEcho(null);
      setError(fillerNudge("stance_early"));
      dropSent(sentBox);
      return;
    }
    if (!opts?.skip && q.id === "stance_early") text = withoutFiller(text);
    if (!opts?.skip && q.id === "stance_early" && wordCount(text) < 25 && earlyTakeFull(text)) text = earlyTakeFull(text)!;
    if (!opts?.skip && q.id === "stance_early" && wordCount(text) < 25) {
      setShortEcho(text);
      setError(moreWordsNote(wordCount(text), 25, "Your early take", text, shortTries.current++));
      return;
    }

    const isVoice =
      q.kind === "interest" ||
      q.kind === "coaching" ||
      q.kind === "personal" ||
      q.kind === "fallback_voice";

    const existing = answers.find((a) => a.questionId === q.id);
    const nextAnswers = [
      ...answers.filter((a) => a.questionId !== q.id),
      ...(opts?.skip
        ? existing
          ? [existing]
          : []
        : [
            {
              questionId: q.id,
              questionText: q.text,
              kind: q.kind,
              answerText: text,
              isVoiceSample: isVoice,
              pasteRatio: pasteMeta.meta.pasteRatio,
            },
          ]),
    ];
    // Move on right away; the answer saves in the background (the device copy
    // stays until the server has it). Waiting on the save made every question
    // feel 1-6s slow.
    const back = editReturn;
    const nextId =
      back && typeof back.at === "number"
        ? coachingPlan[back.at]?.id ?? null
        : back
          ? q.id
          : coachingPlan[qIndex + 1]?.id ?? null;
    if (!demoMode && text) {
      const fieldKey = `stage1:${q.id}`;
      const at = Date.now();
      saveLocalPosition(paperId, {
        questionId: nextId,
        at,
        answered: {
          questionId: q.id,
          questionText: q.text,
          kind: q.kind,
          answerText: text,
          isVoiceSample: isVoice,
          pasteRatio: pasteMeta.meta.pasteRatio,
        },
      });
      const save = () =>
        persistField(paperId, {
          fieldKey,
          text,
          submitted: true,
          resume: { stage: 1, questionId: nextId ?? q.id, screen: "coaching", at },
        });
      void save()
        .then((ok) => ok || new Promise<boolean>((resolve) => setTimeout(() => void save().then(resolve), 1500)))
        .then((ok) => {
          if (ok) clearLocalDraft(paperId, fieldKey);
          else setError("Couldn't save your last answer to the server yet. It's kept on this device; check your connection.");
        });
    }
    setAnswers(nextAnswers);
    dropSent(sentBox);
    setError(null);
    setReoffer(null);
    pasteMeta.reset();
    // QA 7:02 AM: a stance said anywhere ("I want to argue transformational, using Satya Nadella")
    // is saved, and every question it already answers is skipped.
    // Latest brief (not this render's copy): a decision saved a moment ago must not be lost.
    const bNow = briefRef.current ?? brief;
    const people = bNow?.options?.people ?? [];
    const said = text && q.id !== "stance_early" && q.id !== "decision_why" ? parseStance(text, bNow?.options?.options ?? [], people) : null;
    // QA 1:16 walk C: a full pick with a named leader gets the same informed treatment here
    // (affirm by name, locked in word for word, the checklist), never angle cards.
    if (q.id === "decision_pick" && text && said?.leader && !tookRec) {
      setInformedLead(
        informedAffirm(text, {
          leader: said.leader,
          mustInclude: bNow?.readback?.mustInclude ?? [],
          needsPerson: true,
        }),
      );
    }
    if (q.id === "decision_pick" && text) {
      void briefCall({ action: "decision", question: q.text, answer: text }).then(() =>
        said?.leader && !bNow?.leader ? briefCall({ action: "decision", question: "stated", answer: text, slot: "leader", named: said.leader }) : null,
      );
    } else if (said && !bNow?.decision && q.id !== "material_check" && q.id !== "leader_pick") {
      void briefCall({ action: "decision", question: bNow?.options?.question ?? "Your pick", answer: said.stance, source: "stated" }).then(() =>
        said.leader && !bNow?.leader ? briefCall({ action: "decision", question: "stated", answer: said.stance, slot: "leader", named: said.leader }) : null,
      );
    }
    if (q.id === "leader_pick" && text) void briefCall({ action: "decision", question: q.text, answer: text, slot: "leader" });
    if (q.id === "decision_why" && text) {
      const base = (bNow?.decision?.answer || answers.find((a) => a.questionId === "decision_pick")?.answerText || "").replace(/[.!?\s]+$/, "");
      void briefCall({ action: "decision", question: bNow?.decision?.question ?? q.text, answer: (base ? `${base}. ${text}` : text).slice(0, 2000), source: bNow?.decision?.source ?? "asked" });
    }
    if (q.id === "material_check" && text) {
      // They haven't read it / don't know where to start: the key points first (waits briefly, then shows when ready).
      const lost = materialLost(text);
      // Their stance is saved right away (QA 7:02 AM walk): no decision question flashes while options load.
      // Colton 12:08 INFORMED: a stance, or ideas with a leader/example, is locked in (the fallback keeps their words word for word).
      const informed = !lost && !bNow?.decision ? informedSaying(text, bNow?.options?.options ?? []) : null;
      const early = !lost && !bNow?.decision ? parseStance(text, bNow?.options?.options ?? [], people) ?? (informed ? { stance: informed.stance, leader: informed.leader } : null) : null;
      if (early) {
        setInformedLead(
          informedAffirm(text, {
            leader: early.leader,
            mustInclude: bNow?.readback?.mustInclude ?? [],
            needsPerson: people.length > 0 || /\b(?:real|one)\s+(?:leader|person)\b/i.test(bNow?.readback?.ask ?? ""),
          }),
        );
      }
      const savedEarly = early
        ? briefCall({ action: "decision", question: bNow?.options?.question ?? "Your pick", answer: early.stance, source: "stated" }).then(() =>
            early.leader && !bNow?.leader ? briefCall({ action: "decision", question: "stated", answer: early.stance, slot: "leader", named: early.leader }) : null,
          )
        : null;
      // QA 11:40 #5 (lag): the stance save and the options load run side by side, not one after the other.
      const optionsEarly = !lost && !briefRef.current?.options ? briefCall({ action: "options" }) : null;
      if (savedEarly) {
        setDecisionSaving(true);
        await Promise.race([savedEarly, new Promise((r) => setTimeout(r, 4_000))]);
        setDecisionSaving(false);
      }
      const work = (async () => {
        if (lost) {
          setSummaryBusy(true);
          await briefCall({ action: "lost" });
          const v = await briefCall({ action: "summary" });
          setSummaryBusy(false);
          if (!v?.options) await briefCall({ action: "options" });
        } else if (optionsEarly) {
          await optionsEarly;
        } else if (!briefRef.current?.options) {
          await briefCall({ action: "options" });
        }
        // A prepared student's stated stance ("transformational, Satya Nadella") is the decision: never re-asked.
        if (!lost) {
          const o = briefRef.current?.options;
          const parsed = parseStance(text, o?.options ?? [], o?.people ?? []);
          if (parsed && !briefRef.current?.decision) {
            await briefCall({ action: "decision", question: o?.question ?? "Your pick", answer: parsed.stance, source: "stated" });
            if (parsed.leader) await briefCall({ action: "decision", question: "stated", answer: parsed.stance, slot: "leader", named: parsed.leader });
          }
        }
      })();
      // QA 11:40 #5 (lag): an INFORMED answer is already locked in, so the next step never waits on the
      // options lookup (it finishes in the background); everyone else waits up to 12 s for real options.
      // A lost student sees the reassurance and the next step fast; the summary lands under it when ready (QA 1:16: 18 s).
      if (!early?.leader) await Promise.race([work, new Promise((r) => setTimeout(r, lost ? 6_000 : 12_000))]);
      else void work;
    }

    void fetch(`/api/papers/${paperId}/intake/next-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer: text || undefined,
        skipThisQuestion: opts?.skip || undefined,
        questionId: q.id,
        questionText: q.text,
        questionKind: q.kind,
        sequence: qIndex,
        skipInterest: skippedInterest || undefined,
        inputMeta: {
          pastedChars: pasteMeta.meta.pastedChars,
          typedChars: pasteMeta.meta.typedChars,
          pasteEvents: pasteMeta.meta.pasteEvents,
        },
      }),
    }).catch(() => undefined);

    // Offer leads after early take
    if (q.id === "stance_early" && requirements && text) {
      const scholarly = !!requirements.requiredSources.value?.scholarlyRequired;
      const interestAnswers = nextAnswers.filter((a) => a.kind === "interest").map((a) => a.answerText);
      const tags = extractInterestTags(interestAnswers);
      const shown = tags[0] ? interestDisplay(tags[0], interestAnswers) : null;
      const suggested = [
        createLead({
          name: "A practitioner voice in this topic",
          whyAssignment: practitionerReason(requirements.topic.value || requirements.promptQuestion.value, shown),
          scholarlyRequired: scholarly,
          searchTerms: practitionerSearchTerms(requirements.topic.value || requirements.promptQuestion.value, tags[0]),
        }),
      ];
      if (tags[0]) {
        suggested.push(
          createLead({
            name: shown?.media ? `Something from ${shown.name} that shows the same idea` : `An example connected to ${shown?.name ?? tags[0]}`,
            whyAssignment: exampleLeadWhy(tags[0], requirements.topic.value || requirements.promptQuestion.value, interestAnswers),
            whyInterest: `Touches on your interest in ${shown?.name ?? tags[0]}.`,
            steeredBy: "both",
            scholarlyRequired: scholarly,
            searchTerms: leadSearchTerms(requirements.topic.value || requirements.promptQuestion.value, tags[0]),
          }),
        );
      }
      setLeads(suggested);
    }

    // An edited earlier answer: straight back to where the student was.
    if (back) {
      returnFromEdit(nextAnswers);
      return;
    }

    if (qIndex + 1 < coachingPlan.length) {
      const nextQuestion = coachingPlan[qIndex + 1];
      setBoxUnlessTyped(nextAnswers.find((answer) => answer.questionId === nextQuestion.id)?.answerText ?? "", sentBox);
      setQIndex(qIndex + 1);
      return;
    }

    // Revisiting answers after the early take: go back to the checklist.
    if (storyAngle && nextAnswers.some((a) => a.questionId === "stance_early")) {
      setScreen("gate");
      return;
    }

    const voiceAnswers: VoiceAnswer[] = nextAnswers.map((a) => ({
      text: a.answerText,
      isVoiceSample: a.isVoiceSample,
      kind: a.kind,
      pasteRatio: a.pasteRatio,
    }));
    const evalResult = evaluateStage1VoiceMinimum({ answers: voiceAnswers });
    if (
      evalResult.needsFallback &&
      !fallbackOff &&
      !nextAnswers.some((a) => a.kind === "fallback_voice") &&
      !needFallback
    ) {
      setNeedFallback(true);
      setQIndex(coachingPlan.length);
      return;
    }
    // The story angle is already picked (the checklist says so): go on to the
    // early take instead of asking for the story again.
    if (storyAngle) {
      goToStanceOnStory();
      return;
    }
    finishCoaching(nextAnswers);
  }

  function savedAnswerText(questionId: string): string {
    return answers.find((answer) => answer.questionId === questionId)?.answerText ?? "";
  }

  /** Reopen an earlier question with the student's saved answer in the box. */
  function openQuestion(index: number) {
    const target = coachingPlan[index];
    if (!target) return;
    setError(null);
    pasteMeta.reset();
    setDraftAnswer(savedAnswerText(target.id));
    setQIndex(index);
    setScreen("coaching");
  }

  function goToStanceOnStory() {
    // QA 5:46: this runs after her reply lands; words typed since Enter stay in the box.
    setBoxUnlessTyped(savedAnswerText("stance_early"));
    setError(null);
    pasteMeta.reset();
    setScreen("coaching");
    // Stance is appended temporarily via a high qIndex sentinel handled below
    setQIndex(-1); // signals stance-only mode
  }

  async function pickStory(angle: StoryAngle) {
    if (pickingStory) return;
    setPickingStory(angle.id);
    const picked = { text: angle.question, source: "ai" as const };
    setStoryAngle(picked);
    setStoryFromDecision(false);
    await fetch(`/api/papers/${paperId}/intake/story-pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: angle.question,
        source: "ai",
        angleId: angle.id,
      }),
    }).catch(() => undefined);
    setPickingStory(null);
    afterStoryPicked();
  }

  async function submitOwnStory(spoken?: string) {
    setShortEcho(null);
    const rawStory = (spoken ?? ownStory).trim();
    const text = withoutFiller(rawStory);
    if (rawStory && !text) {
      setError(fillerNudge("own_story"));
      if (!spoken) setOwnStory("");
      return;
    }
    if (wordCount(text) < 15) {
      setShortEcho(text);
      setError(moreWordsNote(wordCount(text), 15, "Your own angle", text, shortTries.current++));
      return;
    }
    if (pickingStory) return;
    // A pasted reading paragraph is material, never the angle (QA 6:03 AM).
    if (brief?.northstar && looksLikePastedReading(text, pasteMeta.meta.pasteRatio)) {
      dropSentStory(text);
      pasteMeta.reset();
      setError("That looks like part of the reading, so I saved it as material instead of your angle. Tell me your angle in your own words.");
      const works = requirements ? namedWorksFrom(requirements, rawText) : [];
      const missing = brief?.missing ?? [];
      void briefCall({ action: "reading", title: missing.length === 1 ? missing[0]! : works.length === 1 ? displayWork(works[0]!).replace(/[“”]/g, "") : "Pasted reading", text: text.slice(0, 200_000) });
      return;
    }
    setPickingStory("own");
    setStoryAngle({ text, source: "student" });
    setStoryFromDecision(false);
    setAnswers((prev) => [
      ...prev.filter((a) => a.questionId !== "story_own"),
      {
        questionId: "story_own",
        questionText: "I'll write my own story angle",
        kind: "story_angle",
        answerText: text,
        isVoiceSample: true,
        pasteRatio: pasteMeta.meta.pasteRatio,
      },
    ]);
    await fetch(`/api/papers/${paperId}/intake/story-pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source: "student" }),
    }).catch(() => undefined);
    pasteMeta.reset();
    dropSentStory(text);
    setPickingStory(null);
    afterStoryPicked();
  }

  /**
   * QA 3:51 nit: a real reason (15+ words with a causal link: because, so, led to…) is an early take.
   * Joined with the pick they already gave in their own words, it meets the 25-word server gate
   * without asking for "a couple more sentences". Null when it isn't one.
   */
  function earlyTakeFull(text: string): string | null {
    const t = text.trim();
    if (wordCount(t) >= 25) return t;
    // Round 4 #2: a solid reason is accepted: it joins what they already said (their pick, their
    // reading answer), all their own words, so the 25-word early take is met without a re-ask.
    if (!(isSolidReason(t) || (wordCount(t) >= 15 && CAUSAL_LINK.test(t)))) return null;
    const said = (id: string) => [...answers].reverse().find((a) => a.questionId === id && a.answerText.trim())?.answerText.trim() ?? "";
    const pieces = [lockedInStance || briefRef.current?.decision?.answer || brief?.decision?.answer || "", said("decision_pick"), said("decision_why"), said("material_check")]
      .map((x) => (x ?? "").trim())
      .filter((x, i, all) => x && !isFillerSaying(x) && !isLostSaying(x) && all.findIndex((y) => y === x) === i && !t.includes(x.slice(0, 30)) && !x.includes(t.slice(0, 30)));
    let both = t;
    for (const piece of pieces) {
      if (wordCount(both) >= 25) break;
      both = `${piece}\n${both}`;
    }
    return wordCount(both) >= 25 ? both : null;
  }

  async function submitStanceAnswer(spoken?: string) {
    // QA 3:00: what they already sent (turned back as short) stays part of the take; new lines add to it.
    const prevShort = withoutFiller(error && shortEcho ? shortEcho : "");
    setShortEcho(null);
    const fresh = withoutFiller((spoken ?? draftAnswer).trim());
    // QA 3:26 AM #4: a filler send gets the filler nudge, never "Closer.", and is never kept.
    if (!fresh && (spoken ?? draftAnswer).trim()) {
      if (prevShort) setShortEcho(prevShort);
      setError(fillerNudge("stance_early"));
      if (!spoken) setDraftAnswer("");
      return;
    }
    const joined = prevShort && fresh && !fresh.includes(prevShort) ? `${prevShort}\n${fresh}` : fresh || prevShort;
    const text = earlyTakeFull(joined) ?? joined;
    if (wordCount(text) < 25) {
      setShortEcho(text);
      setError(moreWordsNote(wordCount(text), 25, "Your early take", text, shortTries.current++));
      return;
    }
    if (!demoMode) {
      const saved = await persistField(paperId, {
        fieldKey: "stage1:stance_early",
        text,
        submitted: true,
        resume: { stage: 1, questionId: "stance_early", screen: "gate" },
      });
      if (!saved) {
        setError("Couldn't save that answer. It is still in the box.");
        return;
      }
      void fetch(`/api/papers/${paperId}/intake/next-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: text,
          questionId: "stance_early",
          questionText: "What's your early take?",
          questionKind: "coaching",
          sequence: 50,
        }),
      }).catch(() => undefined);
    }
    const nextAnswers: IntakeAnswer[] = [
      ...answers.filter((a) => a.questionId !== "stance_early"),
      {
        questionId: "stance_early",
        questionText: earlyStanceQuestion({
          topic: requirements?.topic.value,
          promptQuestion: requirements?.promptQuestion.value,
        }),
        kind: "coaching",
        answerText: text,
        isVoiceSample: true,
        pasteRatio: pasteMeta.meta.pasteRatio,
      },
    ];
    setAnswers(nextAnswers);
    // QA 3:00 BLOCKER (one source of truth): an informed lock-in's reason is their early take.
    // The saved decision (what the gate and the server read) gets it, so the gate turns ✓.
    {
      const d = (briefRef.current ?? brief)?.decision;
      const base = d?.answer || lockedInStance || "";
      if (brief?.northstar && base && (!d?.answer || (!decisionHasReason(base) && !base.includes(text.slice(0, 40))))) {
        void briefCall({ action: "decision", question: d?.question ?? brief.options?.question ?? "Your pick", answer: `${base.replace(/[.!?\s]+$/, "")}. ${text}`.slice(0, 2000), source: d?.source ?? "stated" });
      }
    }
    dropSent(fresh);
    pasteMeta.reset();
    setError(null);
    setEditReturn(null);

    if (requirements && leads.length === 0) {
      const scholarly = !!requirements.requiredSources.value?.scholarlyRequired;
      const interestAnswers = nextAnswers.filter((a) => a.kind === "interest").map((a) => a.answerText);
      const tags = extractInterestTags(interestAnswers);
      const shown = tags[0] ? interestDisplay(tags[0], interestAnswers) : null;
      const suggested = [
        createLead({
          name: "A practitioner voice in this topic",
          whyAssignment: practitionerReason(requirements.topic.value || requirements.promptQuestion.value, shown),
          scholarlyRequired: scholarly,
          searchTerms: practitionerSearchTerms(requirements.topic.value || requirements.promptQuestion.value, tags[0]),
        }),
      ];
      if (tags[0]) {
        suggested.push(
          createLead({
            name: shown?.media ? `Something from ${shown.name} that shows the same idea` : `An example connected to ${shown?.name ?? tags[0]}`,
            whyAssignment: exampleLeadWhy(tags[0], requirements.topic.value || requirements.promptQuestion.value, interestAnswers),
            whyInterest: `Touches on your interest in ${shown?.name ?? tags[0]}.`,
            steeredBy: "both",
            scholarlyRequired: scholarly,
            searchTerms: leadSearchTerms(requirements.topic.value || requirements.promptQuestion.value, tags[0]),
          }),
        );
      }
      setLeads(suggested);
    }

    const voiceAnswers: VoiceAnswer[] = nextAnswers.map((a) => ({
      text: a.answerText,
      isVoiceSample: a.isVoiceSample,
      kind: a.kind,
      pasteRatio: a.pasteRatio,
    }));
    const evalResult = evaluateStage1VoiceMinimum({ answers: voiceAnswers });
    if (
      evalResult.needsFallback &&
      !fallbackOff &&
      !nextAnswers.some((a) => a.kind === "fallback_voice") &&
      !needFallback
    ) {
      setNeedFallback(true);
      setQIndex(coachingPlan.length);
      setScreen("coaching");
      return;
    }
    setScreen("gate");
  }

  function acceptLead(lead: ResearchLeadDraft) {
    setLeads((prev) =>
      prev.map((l) =>
        l.name === lead.name ? { ...l, status: "to_verify" as const } : l,
      ),
    );
  }

  /** Tap an earlier answer's bubble: reopen that question with the answer in the box. */
  function editAnswer(target: number | "story" | "stance") {
    if (submitting || pickingStory) return;
    setEditSeq((n) => n + 1);
    if (!editReturn) {
      setEditReturn({
        at: screen === "story" ? "story" : screen === "gate" ? "gate" : qIndex < 0 ? "stance" : qIndex,
        draft: screen === "story" ? ownStory : screen === "coaching" ? draftAnswer : "",
      });
    }
    if (target === "story") {
      setError(null);
      setScreen("story");
      return;
    }
    if (target === "stance") {
      goToStanceOnStory();
      return;
    }
    openQuestion(target);
  }

  /** After an edit is sent (or cancelled), go back to where the student was, with their typing. */
  function returnFromEdit(nextAnswers: IntakeAnswer[]) {
    const back = editReturn;
    setEditReturn(null);
    setRecovering(false);
    setError(null);
    pasteMeta.reset();
    if (!back) return;
    if (back.at === "story") {
      setOwnStory(back.draft);
      setScreen("story");
      return;
    }
    if (back.at === "gate") {
      setScreen("gate");
      return;
    }
    if (back.at === "stance") {
      goToStanceOnStory();
      setDraftAnswer(back.draft || nextAnswers.find((a) => a.questionId === "stance_early")?.answerText || "");
      return;
    }
    const target = coachingPlan[back.at];
    setScreen("coaching");
    setQIndex(back.at);
    setDraftAnswer(back.draft || nextAnswers.find((a) => a.questionId === target?.id)?.answerText || "");
  }

  /** Story picked (or changed): on to the early take, or back to the wrap-up if that's done. */
  function afterStoryPicked() {
    const back = editReturn;
    setEditReturn(null);
    if (back?.at === "gate" && answers.some((a) => a.questionId === "stance_early")) {
      setScreen("gate");
      return;
    }
    goToStanceOnStory();
    if (back?.at === "stance" && back.draft) setDraftAnswer(back.draft);
  }

  async function completeStage1() {
    if (!requirements || !paper || startingStance) return;
    if (!cardGate.ok) {
      setError("Confirm the assignment card first.");
      return;
    }
    if (!stanceOk) {
      setError("Add a couple more sentences to your early take.");
      return;
    }
    setStartingStance(true);

    try {
      // PC-29 QA round 3: the last answer's decision save lands first, so Stage 2 opens with it.
      await briefIdle(8_000);
      const post = () =>
        fetch(`/api/papers/${paperId}/intake/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requirements,
            answers,
            leads,
            useInterestProfile: !skippedInterest,
            storyAngle: storyAngle ?? undefined,
          }),
        });
      let res = await post();
      // QA 10:21 suite: a confirmed read-back the server lost (a write race) is re-saved and
      // the start retried once, never a dead "Finish the Stage 1 steps first".
      if (res.status === 400 && cardGate.ok) {
        const peek = (await res.clone().json().catch(() => ({}))) as { reasons?: string[] };
        if (peek.reasons?.includes("readback")) {
          await briefCall({ action: "confirm_readback" });
          res = await post();
        }
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; reasons?: string[]; reask?: string };
        setStartingStance(false);
        // The server says the decision is missing: re-ask it right here (never a dead end).
        if (data.reasons?.includes("decision")) {
          setError(null);
          setForceRecover(data.reask ?? "decision_why");
          return;
        }
        setError(data.error ?? "Could not finish Stage 1.");
        return;
      }
    } catch {
      /* fall through to local demo complete */
    }

    if (!storyAngle) {
      setError("Pick a story angle before continuing.");
      setScreen("story");
      return;
    }
    // PC-29 QA minor: Stage 1 is finished; the voice call ends cleanly (after her short "Let's go.").
    if (rt.on) window.setTimeout(() => rt.stop(), 1_500);

    const sample = answers
      .filter((a) => a.isVoiceSample)
      .map((a) => a.answerText)
      .join("\n");
    const metrics = computeStyleMetrics(sample);

    const progress = paper.stage_progress.map((s) => {
      if (s.stage === 1) {
        return {
          ...s,
          status: "complete" as const,
          data: {
            requirements,
            answers,
            leads,
            useInterestProfile: !skippedInterest,
          },
        };
      }
      if (s.stage === 2) {
        return { ...s, status: "in_progress" as const };
      }
      return s;
    });

    const next: DemoPaper = {
      ...paper,
      current_stage: 2,
      stage_progress: progress,
      style_profile: { ...metrics, raw_sample: sample },
    };
    upsertDemoPaper(next);
    router.push(`/app/papers/${paperId}/stage/2`);
  }

  if (screen === "upload") {
    const hasFiles = stagedFiles.length > 0;
    const uploadSpeak: SpeakItem[] = [
      { key: "ask", text: `${ASSIGNMENT_GREETING} ${ASSIGNMENT_ASK}`, turn: !error, opener: true },
      ...(error && /^(Tell me|Give me|I couldn)/.test(error) ? [{ key: `err:${error}`, text: error, turn: true }] : []),
    ];
    return (
      <div className="mx-auto max-w-[680px]">
        <SpeakNew scope={paperId} items={rtMode ? [] : uploadSpeak} />
        <ChatHeader eyebrow="Stage 1 · Intake" eyebrowClassName={dsEyebrow} hideVoice={hideReadAloud} />
        <div className="mt-4 space-y-6">
          <PauPauGroup
            showName
            bubbles={[
              ASSIGNMENT_GREETING,
              ASSIGNMENT_ASK,
              error && !sentMessage ? <span key="err" role="alert">{error}</span> : null,
            ]}
            headingIndex={1}
            headingId="assignment-ask"
            live={Boolean(error && !sentMessage)}
          />
          {error && sentMessage ? <StudentBubble message={sentMessage} /> : null}
          {error && sentMessage ? (
            <PauPauBubble showName={false} live>
              <span role="alert">{error}</span>
            </PauPauBubble>
          ) : null}
          <div>
            <ChatComposer
              paperId={paperId}
              labelledBy="assignment-ask"
              value={paste}
              onChange={setPaste}
              placeholder="Upload a photo, PDF, or Word file, or just tell me about it…"
              files={stagedFiles}
              onFilesChange={setStagedFiles}
              onRetryFile={(id) => void retryFile(id)}
              onError={setError}
              onSend={() => void runParse()}
              realtimeSlot={rtMode ? <RealtimeControls call={rt} /> : undefined}
              sendLabel="Send"
              sendBlocked={hasFiles && !rightsOk}
            />
            {hasFiles ? (
              <>
                <label className="mt-4 flex items-start gap-2 text-[16px] leading-[1.6] text-ds-ink">
                  <input
                    type="checkbox"
                    className="mt-[6px] h-4 w-4 accent-[#c4785a]"
                    checked={rightsOk}
                    onChange={(e) => {
                      setRightsOk(e.target.checked);
                      if (e.target.checked) setError(null);
                    }}
                  />
                  <span>I&apos;m uploading this for my own coursework.</span>
                </label>
                <p className="mt-2 text-[13px] leading-[1.6] text-ds-muted">
                  We keep these files while this paper is on your account, and for 90 days after it&apos;s deleted. You
                  can remove a file anytime.
                </p>
              </>
            ) : null}
          </div>
        </div>
        {demoMode ? (
          // Noticeable but calm (QA 8:45 PM #4): a quiet card with an icon, ink text.
          <p
            className="mt-6 flex items-start gap-2 rounded-[8px] border border-ds-border bg-ds-surface px-4 py-3 text-[14px] leading-[1.5] text-ds-ink"
            data-demo-files-note
          >
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ds-muted" />
            <span>
              <span className="font-semibold">Demo mode</span> reads your files the same way, but nothing is saved.
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  if (screen === "parsing") {
    return (
      <div className="mx-auto max-w-[680px]">
        <ChatHeader eyebrow="Stage 1 · Intake" eyebrowClassName={dsEyebrow} hideVoice={hideReadAloud} />
        <div className="mt-4 space-y-6">
          <PauPauGroup showName bubbles={[ASSIGNMENT_GREETING, ASSIGNMENT_ASK]} />
          {sentMessage ? <StudentBubble message={sentMessage} /> : null}
          <ReadingBubble status={parseStatus} startedAt={parseStartedAt} />
        </div>
      </div>
    );
  }

  if (screen === "followup" && requirements) {
    return (
      <div className="mx-auto max-w-[680px]">
        <CoachEyebrow label="One quick check" />
        <h1 className={cn(dsH1, "mt-2")}>
          Anything else for the assignment?
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-ds-muted">
          Is there any other context or page you want to add so I fully understand
          the assignment?
        </p>
        {error ? (
          <p className="mt-4 text-[16px] leading-[1.6] text-ds-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-4">
          <DsButton
            type="button"
            variant="secondary"
            onClick={() => {
              setFollowupAsked(true);
              setScreen("upload");
            }}
          >
            Add files or text
          </DsButton>
          <DsButton
            type="button"
            variant="primary"
            onClick={() => {
              setFollowupAsked(true);
              void fetch(`/api/papers/${paperId}/assignment/followup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ done: true }),
              }).catch(() => undefined);
              setScreen("card");
            }}
          >
            No, that&apos;s everything
          </DsButton>
        </div>
      </div>
    );
  }

  if (screen === "card" && requirements && !editingDetails) {
    return (
      <div className="mx-auto max-w-[680px]">
        <ChatHeader eyebrow="Stage 1 · Intake" eyebrowClassName={dsEyebrow} hideVoice={hideReadAloud} />
        {focusTools}
        <div className="mt-4 space-y-6">
          {snap ? null : <PauPauGroup showName bubbles={[ASSIGNMENT_GREETING, ASSIGNMENT_ASK]} />}
          {sentMessage && !snap ? <StudentBubble message={sentMessage} /> : null}
          {confirmReady ? (
            <PauPauConfirm
              paperId={paperId}
              requirements={requirements}
              onChange={setRequirements}
              onConfirm={() => void confirmCard()}
              onBrief={(view) => setBrief(view as unknown as BriefView)}
              materialSlot={brief && (brief.summary || brief.summaries?.length) ? <MaterialBubbles brief={brief} paperId={paperId} darkWebOk={false} lead="" /> : null}
              onStartOver={() => {
                setConfirmTurns([]);
                setScreen("upload");
              }}
              confirming={confirming}
              error={error}
              turns={confirmTurns}
              onTurns={setConfirmTurns}
              sheetText={rawText}
              hideBefore={snap?.confirm ?? 0}
              opener={<FocusOpener line={welcomeLine} scope={paperId} signal={`${screen}:${qIndex}:${answers.length}:${confirmTurns.length}`} silent={rtMode} onProgress={() => setPanel("skeleton")} />}
              sendRef={confirmSendRef}
              oldVoiceOff={rtMode}
              realtimeSlot={rtMode ? <RealtimeControls call={rt} /> : undefined}
              live={rt.on ? <LiveTurns rows={rt.live} /> : null}
            />
          ) : (
            <ReadingBubble status="Getting your conversation back…" startedAt={Date.now()} />
          )}
        </div>
      </div>
    );
  }

  if (screen === "card" && requirements) {
    return (
      <div className="mx-auto max-w-[680px]">
        <h1 className={dsH1}>Fix the details</h1>
        <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted">
          Change anything {COACH_NAME} got wrong. Your edits are what the coaching uses.
        </p>
        {error ? (
          <p id="confirm-error" className="mt-4 text-[16px] leading-[1.6] text-ds-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 space-y-6">
          <CardField
            label="Course"
            attention={fieldNeedsAttention(requirements.course)}
            confirmed={requirements.course.confirmed}
          >
            <Input
              className={dsInput}
              value={requirements.course.value ?? ""}
              onChange={(e) =>
                updateField(
                  "course",
                  markFieldConfirmed(requirements.course, {
                    value: e.target.value || null,
                  }),
                )
              }
            />
            <FieldActions
              onLooksRight={() =>
                updateField("course", markFieldConfirmed(requirements.course))
              }
              onNotSpecified={() =>
                updateField("course", markNotSpecified(requirements.course))
              }
            />
          </CardField>

          <CardField
            label="Instructor"
            attention={Boolean(requirements.instructor?.value) && fieldNeedsAttention(requirements.instructor ?? emptyField<string>())}
            confirmed={Boolean(requirements.instructor?.confirmed)}
          >
            <Input
              className={dsInput}
              value={requirements.instructor?.value ?? ""}
              onChange={(e) =>
                updateField(
                  "instructor",
                  markFieldConfirmed(requirements.instructor ?? emptyField<string>(), {
                    value: e.target.value || null,
                  }),
                )
              }
            />
          </CardField>

          <CardField
            label="Topic / prompt question"
            attention={
              fieldNeedsAttention(requirements.topic) ||
              fieldNeedsAttention(requirements.promptQuestion)
            }
            confirmed={
              requirements.topic.confirmed && requirements.promptQuestion.confirmed
            }
          >
            <Label className="text-[13px] font-semibold text-ds-muted">Topic</Label>
            <Input
              className={dsInput}
              value={requirements.topic.value ?? ""}
              onChange={(e) =>
                updateField(
                  "topic",
                  markFieldConfirmed(requirements.topic, {
                    value: e.target.value || null,
                  }),
                )
              }
            />
            <Label className="mt-4 block text-[13px] font-semibold text-ds-muted">Prompt question</Label>
            <Textarea
              className={dsTextarea}
              rows={3}
              value={requirements.promptQuestion.value ?? ""}
              onChange={(e) =>
                updateField(
                  "promptQuestion",
                  markFieldConfirmed(requirements.promptQuestion, {
                    value: e.target.value || null,
                  }),
                )
              }
            />
            <FieldActions
              onLooksRight={() => {
                updateField("topic", markFieldConfirmed(requirements.topic));
                updateField(
                  "promptQuestion",
                  markFieldConfirmed(requirements.promptQuestion),
                );
              }}
              onViewSource={sourceAction(
                requirements.topic.value
                  ? requirements.topic
                  : requirements.promptQuestion,
                "Topic / prompt",
                setViewSource,
              )}
            />
          </CardField>

          <CardField
            label="Length"
            attention={fieldNeedsAttention(requirements.length)}
            confirmed={requirements.length.confirmed}
          >
            <p className="text-[16px] leading-[1.6] text-ds-muted">
              {formatLengthLabel(requirements.length.value)}
            </p>
            <Input
              className={cn(dsInput, "mt-2")}
              value={requirements.length.value?.raw ?? ""}
              placeholder='e.g. 5–7 pages or 1500 words'
              onChange={(e) =>
                updateField(
                  "length",
                  markFieldConfirmed(requirements.length, {
                    value: {
                      ...(requirements.length.value ?? {}),
                      raw: e.target.value,
                    },
                  }),
                )
              }
            />
            <FieldActions
              onLooksRight={() =>
                updateField("length", markFieldConfirmed(requirements.length))
              }
              onNotSpecified={() =>
                updateField("length", markNotSpecified(requirements.length))
              }
              onViewSource={sourceAction(
                requirements.length,
                "Length",
                setViewSource,
              )}
            />
          </CardField>

          <CardField
            label="Citation style"
            attention={fieldNeedsAttention(requirements.citationStyle)}
            confirmed={requirements.citationStyle.confirmed}
          >
            <select
              className={dsSelect}
              value={requirements.citationStyle.value ?? ""}
              onChange={(e) =>
                updateField(
                  "citationStyle",
                  markFieldConfirmed(requirements.citationStyle, {
                    value: (e.target.value || null) as CitationStyle | null,
                  }),
                )
              }
            >
              {CITATION_OPTIONS.map((opt) => (
                <option key={opt || "empty"} value={opt}>
                  {opt || "Select…"}
                </option>
              ))}
            </select>
            {requirements.citationStyle.value === "other" ? (
              <Input
                className={cn(dsInput, "mt-2")}
                placeholder="Describe the style"
                value={requirements.citationStyleOther ?? ""}
                onChange={(e) =>
                  setRequirements({
                    ...requirements,
                    citationStyleOther: e.target.value,
                  })
                }
              />
            ) : null}
            <FieldActions
              onLooksRight={() =>
                updateField(
                  "citationStyle",
                  markFieldConfirmed(requirements.citationStyle),
                )
              }
              onNotSpecified={() =>
                updateField(
                  "citationStyle",
                  markNotSpecified(requirements.citationStyle),
                )
              }
              onViewSource={sourceAction(
                requirements.citationStyle,
                "Citation style",
                setViewSource,
              )}
            />
          </CardField>

          {(
            [
              ["paperType", "Paper type"],
              ["dueDate", "Due date"],
              ["otherInstructions", "Other instructions"],
              ["language", "Language"],
            ] as const
          ).map(([key, label]) => (
            <CardField
              key={key}
              label={label}
              attention={fieldNeedsAttention(requirements[key])}
              confirmed={requirements[key].confirmed}
            >
              {key === "otherInstructions" ? (
                // Multi-line so Enter keeps a line break between instructions.
                <Textarea
                  className={dsTextarea}
                  rows={3}
                  value={(requirements[key].value as string | null) ?? ""}
                  onChange={(e) =>
                    updateField(
                      key,
                      markFieldConfirmed(requirements[key], {
                        value: e.target.value || null,
                      }),
                    )
                  }
                />
              ) : (
                <Input
                  className={dsInput}
                  value={(requirements[key].value as string | null) ?? ""}
                  onChange={(e) =>
                    updateField(
                      key,
                      markFieldConfirmed(requirements[key], {
                        value: e.target.value || null,
                      }),
                    )
                  }
                />
              )}
              <FieldActions
                onLooksRight={() =>
                  updateField(key, markFieldConfirmed(requirements[key]))
                }
                onNotSpecified={() =>
                  updateField(key, markNotSpecified(requirements[key]))
                }
              />
            </CardField>
          ))}

          {(
            [
              ["formattingRules", "Formatting rules"],
              ["structuralRequirements", "Structural requirements"],
            ] as const
          ).map(([key, label]) => (
            <CardField
              key={key}
              label={label}
              attention={fieldNeedsAttention(requirements[key])}
              confirmed={requirements[key].confirmed}
            >
              <ListTextarea
                value={(requirements[key].value ?? []).join("\n")}
                onChange={(raw) =>
                  updateField(
                    key,
                    markFieldConfirmed(requirements[key], {
                      value: splitListLines(raw),
                    }),
                  )
                }
              />
              <FieldActions
                onLooksRight={() =>
                  updateField(key, markFieldConfirmed(requirements[key]))
                }
                onNotSpecified={() =>
                  updateField(key, markNotSpecified(requirements[key]))
                }
              />
            </CardField>
          ))}

          <CardField
            label="Required sources"
            attention={fieldNeedsAttention(requirements.requiredSources)}
            confirmed={requirements.requiredSources.confirmed}
          >
            <Textarea
              className={dsTextarea}
              rows={2}
              value={requiredSourcesText(requirements.requiredSources.value)}
              onChange={(e) =>
                updateField(
                  "requiredSources",
                  markFieldConfirmed(requirements.requiredSources, {
                    // The box shows count, types and named sources together;
                    // what the student types replaces all of it.
                    value: {
                      ...(requirements.requiredSources.value ?? {}),
                      types: e.target.value,
                      notes: undefined,
                    },
                  }),
                )
              }
            />
            <FieldActions
              onLooksRight={() =>
                updateField(
                  "requiredSources",
                  markFieldConfirmed(requirements.requiredSources),
                )
              }
              onNotSpecified={() =>
                updateField(
                  "requiredSources",
                  markNotSpecified(requirements.requiredSources),
                )
              }
            />
          </CardField>

          <CardField
            label="Provided readings and links"
            attention={fieldNeedsAttention(requirements.providedReadings)}
            confirmed={requirements.providedReadings.confirmed}
          >
            <ListTextarea
              value={(requirements.providedReadings.value ?? [])
                .map((r) => r.title || r.url || "")
                .filter(Boolean)
                .join("\n")}
              onChange={(raw) =>
                updateField(
                  "providedReadings",
                  markFieldConfirmed(requirements.providedReadings, {
                    value: splitListLines(raw).map((title) => ({ title })),
                  }),
                )
              }
            />
            <FieldActions
              onLooksRight={() =>
                updateField(
                  "providedReadings",
                  markFieldConfirmed(requirements.providedReadings),
                )
              }
              onNotSpecified={() =>
                updateField(
                  "providedReadings",
                  markNotSpecified(requirements.providedReadings),
                )
              }
            />
          </CardField>

          <CardField
            label="Rubric criteria"
            attention={fieldNeedsAttention(requirements.rubricCriteria)}
            confirmed={requirements.rubricCriteria.confirmed}
          >
            <ListTextarea
              value={(requirements.rubricCriteria.value ?? [])
                .map((c) => c.name)
                .join("\n")}
              onChange={(raw) =>
                updateField(
                  "rubricCriteria",
                  markFieldConfirmed(requirements.rubricCriteria, {
                    value: splitListLines(raw).map((name) => ({ name })),
                  }),
                )
              }
            />
            <FieldActions
              onLooksRight={() =>
                updateField(
                  "rubricCriteria",
                  markFieldConfirmed(requirements.rubricCriteria),
                )
              }
              onNotSpecified={() =>
                updateField(
                  "rubricCriteria",
                  markNotSpecified(requirements.rubricCriteria),
                )
              }
            />
          </CardField>

          <CardField
            label="AI policy in the prompt"
            attention={fieldNeedsAttention(requirements.aiPolicy)}
            confirmed={requirements.aiPolicy.confirmed}
          >
            <select
              className={dsSelect}
              value={requirements.aiPolicy.value ?? "unspecified"}
              onChange={(e) =>
                updateField(
                  "aiPolicy",
                  markFieldConfirmed(requirements.aiPolicy, {
                    value: e.target.value as AssignmentRequirements["aiPolicy"]["value"],
                  }),
                )
              }
            >
              <option value="unspecified">Unspecified</option>
              <option value="allowed">Allowed</option>
              <option value="restricted">Restricted</option>
              <option value="forbidden">Forbidden</option>
            </select>
            <FieldActions
              onNotSpecified={() =>
                updateField("aiPolicy", markNotSpecified(requirements.aiPolicy))
              }
            />
          </CardField>
        </div>

        {error ? (
          <p className="mt-4 text-[16px] leading-[1.6] text-ds-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-4">
          <DsButton type="button" variant="secondary" onClick={() => setEditingDetails(false)}>
            Back to {COACH_NAME}
          </DsButton>
          <DsButton
            type="button"
            variant="primary"
            disabled={confirming}
            onClick={() => void confirmCard()}
          >
            {confirming ? "Saving…" : "Let's go"}
          </DsButton>
        </div>

        {viewSource ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(28,43,45,0.4)] p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="View source"
          >
            <div className="max-h-[70vh] w-full max-w-[560px] overflow-auto rounded-[12px] border border-ds-border bg-ds-surface p-8 font-ds-sans shadow-ds-card">
              <p className={dsEyebrow}>
                View source · {viewSource.label}
              </p>
              <pre className="mt-4 whitespace-pre-wrap font-ds-sans text-[16px] leading-[1.6] text-ds-ink">
                {viewSource.excerpt}
              </pre>
              <DsButton
                type="button"
                className="mt-4"
                variant="secondary"
                onClick={() => setViewSource(null)}
              >
                Close
              </DsButton>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (screen === "ai_policy" && requirements) {
    return (
      <div className="mx-auto max-w-[680px]">
        <p className={dsEyebrow}>
          Teacher AI policy
        </p>
        <h1 className={cn(dsH1, "mt-2")}>
          Check before you continue
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-ds-ink">
          {AI_POLICY_NOTICE}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <DsButton
            type="button"
            variant="secondary"
            onClick={() => {
              setScreen("card");
              setError(null);
            }}
          >
            I&apos;ll check first
          </DsButton>
          <DsButton
            type="button"
            variant="primary"
            onClick={() => void confirmCard({ aiPolicyAck: true })}
          >
            Continue anyway
          </DsButton>
        </div>
      </div>
    );
  }

  if ((screen === "coaching" || screen === "story" || screen === "gate") && requirements) {
    const stanceMode = screen === "coaching" && qIndex < 0;
    const introBubbles = brief?.northstar ? [STAGE_PURPOSE[1], ...INTRO_BUBBLES] : INTRO_BUBBLES;
    const stanceBase = earlyStanceQuestion({
      topic: requirements.topic.value,
      promptQuestion: requirements.promptQuestion.value,
    });
    // Colton 12:08 (INFORMED): straight to the next thing the assignment needs, never a re-ask.
    const stanceText =
      brief?.northstar && brief.decision?.source === "stated"
        ? informedNext(
            [brief.decision.answer, answers.find((a) => a.questionId === "material_check")?.answerText ?? ""].join(" "),
            brief.leader?.pick && brief.leader.pick !== "their own" ? brief.leader.pick : brief.leader?.answer && brief.leader.question === "stated" ? null : null,
            answers.some((a) => a.questionId === "story_own"),
          )
        : stanceBase;
    const informedStance = [brief?.decision?.answer ?? "", answers.find((a) => a.questionId === "material_check")?.answerText ?? ""].join(" ").trim();
    const informedLeader =
      (brief?.leader?.pick && brief.leader.pick !== "their own" ? brief.leader.pick : null) ?? informedSaying(informedStance)?.leader ?? null;
    const informedStory = Boolean(brief?.northstar && (brief?.decision?.source === "stated" || informedLead));
    const q =
      screen !== "coaching"
        ? null
        : stanceMode
          ? { id: "stance_early", kind: "coaching" as const, text: stanceText }
          : coachingPlan[qIndex];
    const isInterest = q?.kind === "interest";
    const editing = editReturn !== null;
    const introAbove = Boolean(q && !editing && q.id === coachingPlan[0]?.id && qaAsides.some((x) => x.qid === q.id && !snap?.asides.has(x.id)));
    // Latest answer wins (an edit replaces the earlier one).
    const answerFor = (id: string) =>
      [...answers].reverse().find((a) => a.questionId === id && a.answerText.trim())?.answerText ?? "";
    const stanceAnswer = answerFor("stance_early");
    const beyondPlan = screen !== "coaching" || stanceMode;
    const lastAnswered = coachingPlan.reduce((last, item, i) => (answerFor(item.id) ? i : last), -1);
    // Questions reached so far: everything answered, plus any skipped on the way.
    const reach = beyondPlan
      ? coachingPlan.length
      : Math.max(lastAnswered + 1, qIndex);
    const sample = answers
      .filter((a) => a.isVoiceSample)
      .map((a) => a.answerText)
      .join("\n");
    const metrics = screen === "gate" && sample ? computeStyleMetrics(sample) : null;
    // The student sees words against the 200-word target, so that is what the
    // check mark and the "short side" note follow.
    const voiceWordsMet = voiceEval.totalWords >= STAGE1_VOICE_MIN_WORDS;
    const blockers = stanceStartBlockers({
          northstar: northstarGate,
      checklistConfirmed: cardGate.ok,
      hasStory: Boolean(storyAngle),
      voiceOk: voiceEval.ok,
      voiceReason: voiceEval.reasons[0],
      stanceOk,
    });
    const draftWords = wordCount(screen === "story" ? ownStory : draftAnswer);
    // The gate checklist (north star: confirmed, material, decision with reason, early take).
    const gateChecks = northstarGate ? (
                  <ul key="checks" className="space-y-1 text-[16px] leading-[1.6]" data-gate-checklist>
                    {northstarChecklist({
                      confirmed: cardGate.ok,
                      catchUpDone: northstarGate.catchUpDone,
                      decided: northstarGate.decided,
                      stanceOk,
                      materialLabel: materialGateLabel({
                        catchUpDone: northstarGate.catchUpDone,
                        materialShown: Boolean(brief?.materialShown),
                        kinds: (brief?.summaries?.length ? brief.summaries : brief?.summary ? [brief.summary] : []).map((x) => x.kind),
                        materialAnswer: answers.filter((a) => a.questionId === "material_check").at(-1)?.answerText ?? null,
                        shownInChat: caughtUp,
                        lostAtStart: Boolean(brief?.lostAtStart),
                      }),
                    }).map((item) => (
                      <li key={item.label}>
                        {item.done ? "✓" : "○"} {item.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                <ul key="checks" className="space-y-1 text-[16px] leading-[1.6]">
                  <li>{cardGate.ok ? "✓" : "○"} Assignment checklist confirmed</li>
                  <li>{storyAngle ? "✓" : "○"} Story angle picked</li>
                  <li>
                    {voiceWordsMet
                      ? "✓ Voice sample: plenty to match your voice"
                      : "· Voice sample: a good start. More of your own writing helps Pau match your voice (optional)"}
                    <span className="sr-only">
                      {` (${voiceEval.totalWords} of ${STAGE1_VOICE_MIN_WORDS} words)`}
                    </span>
                  </li>
                  <li>{stanceOk ? "✓ Early take: a few sentences in your own words" : "○ Early take: a few sentences in your own words"}</li>
                </ul>
                );
    // A friendly nudge while the note is short, never a bare word counter (QA 6:03 AM).
    // QA 3:00: the typing hint never stands in for Pau's reply: hidden while she is replying,
    // while a message is pending or queued, and whenever her reply is on screen.
    const hintQuiet = Boolean(error) || submitting || Boolean(pendingSaid) || Boolean(queuedSaid);
    const minNote = hintQuiet ? null : stanceMode ? shortNoteNudge("stance", draftWords) : screen === "story" ? shortNoteNudge("story", draftWords) : null;
    const isVoiceQuestion = Boolean(q && q.kind !== "background");
    // Photos, a paste or a link to the reading (north star B; Colton 11:41 PM).
    const readingTools = q ? (readingOpen ? (
                    <div className="space-y-2">
                      <label className="block text-[13px] text-ds-muted" htmlFor="reading-files">
                        Take photos of the pages (or upload a PDF or Word file):
                      </label>
                      <input
                        id="reading-files"
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.rtf,.odt"
                        disabled={readingBusy}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []).slice(0, 12);
                          e.target.value = "";
                          if (!files.length) return;
                          setReadingBusy(true);
                          setReadingNote("Reading your pages…");
                          void (async () => {
                            const texts: string[] = [];
                            for (const f of files) {
                              const r = await extractFileText(paperId, f).catch(() => null);
                              if (r && r.ok && r.text.trim()) texts.push(r.text.trim());
                            }
                            const text = texts.join("\n\n");
                            const v = text ? await briefCall({ action: "reading", title: files.length === 1 ? files[0]!.name : `${files.length} photos of your reading`, text: text.slice(0, 200_000) }) : null;
                            setReadingBusy(false);
                            setReadingNote(v ? null : "I couldn't read text from those. Try clearer photos, or paste the text.");
                            if (v) {
                              setReadingOpen(false);
                              setReoffer(q.id);
                            }
                          })();
                        }}
                        className="block text-[14px]"
                      />
                      <label className="block text-[13px] text-ds-muted" htmlFor="reading-link">
                        Or send me a link to it:
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="reading-link"
                          type="url"
                          inputMode="url"
                          placeholder="https://…"
                          value={readingLink}
                          onChange={(e) => setReadingLink(e.target.value)}
                          className="ds-focus min-h-[40px] flex-1 rounded-[8px] border border-ds-border bg-ds-page px-3 text-[15px]"
                        />
                        <DsButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={readingBusy || !/^https?:\/\/\S+\.\S+/.test(readingLink.trim())}
                          onClick={() => {
                            setReadingBusy(true);
                            setReadingNote("Opening your link…");
                            void briefCall({ action: "reading_link", url: readingLink.trim() }).then((v) => {
                              setReadingBusy(false);
                              setReadingNote(null);
                              if (v) {
                                setReadingLink("");
                                setReadingOpen(false);
                                setReoffer(q.id);
                              }
                            });
                          }}
                        >
                          Use this link
                        </DsButton>
                      </div>
                      {readingNote ? (
                        <p className="text-[13px] text-ds-muted" role="status">
                          {readingNote}
                        </p>
                      ) : null}
                      <label className="block text-[13px] text-ds-muted" htmlFor="reading-paste">
                        Paste the reading (or the part you were assigned). I&apos;ll use it for the key points.
                      </label>
                      <textarea
                        id="reading-paste"
                        className="ds-focus min-h-[120px] w-full rounded-[8px] border border-ds-border bg-ds-page p-3 text-[15px]"
                        value={readingText}
                        onChange={(e) => setReadingText(e.target.value)}
                      />
                      <DsButton
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={readingBusy || readingText.trim().length < 200}
                        onClick={() => {
                          setReadingBusy(true);
                          void briefCall({ action: "reading", title: "Pasted reading", text: readingText.trim() }).then((v) => {
                            setReadingBusy(false);
                            if (v) {
                              setReadingOpen(false);
                              setReadingText("");
                              setReoffer(q.id);
                            }
                          });
                        }}
                      >
                        {readingBusy ? "Reading it…" : "Use this reading"}
                      </DsButton>
                    </div>
                  ) : null) : null;
    const statusFor = (said: string) =>
      q?.id === "material_check" && materialLost(said)
        ? "Digging it up… pulling together the key points."
        : q?.id === "material_check" || ((brief?.northstar ?? true) && mayNeedLookup(said)) || wordCount(said) >= 25
          ? "Digging it up…"
          : "Thinking…";
    const send = (text?: string) => {
      const typedNow = (text ?? draftAnswer).trim();
      // QA 1:16 (composer): a second, different message sent right after the first joins it, so
      // both are kept and Pau replies once. Identical repeats (double Enter) add nothing.
      if (coalesce.current) {
        if (typedNow && !coalesce.current.text.split("\n").includes(typedNow)) coalesce.current.text += `\n${typedNow}`;
        if (!text) setDraftAnswer("");
        setPendingSaid(coalesce.current.text);
        return;
      }
      // QA 9:37 AM: one send at a time, even for two taps in the same tick.
      // QA 3:00: typed while a reply is in flight: queued (on screen), never dropped.
      if (submitting || sendLock.current) {
        if (typedNow && !text) {
          const prev = queuedRef.current;
          queuedRef.current = prev ? (prev.split("\n").includes(typedNow) ? prev : `${prev}\n${typedNow}`) : typedNow;
          setQueuedSaid(queuedRef.current);
          setDraftAnswer("");
        }
        return;
      }
      if (typedNow && !text) {
        sendLock.current = true;
        if (!text) setDraftAnswer("");
        setPendingSaid(typedNow);
        setAsideBusy(statusFor(typedNow));
        const entry = { text: typedNow, timer: setTimeout(() => {
          const merged = coalesce.current?.text ?? typedNow;
          coalesce.current = null;
          sendLock.current = false;
          // QA 5:46: between steps (the last question answered, the early take not up yet) the
          // render that took this Enter has nothing to send it to, so go through the latest
          // screen and retry until something takes it; never dropped silently.
          const fireNow = (n: number) => {
            const went = latestSendNow.current?.(merged, true);
            if (went === false && n < 80) {
              setTimeout(() => fireNow(n + 1), 75);
              return;
            }
            if (went === false) {
              setPendingSaid(null);
              setAsideBusy(null);
              setDraftAnswer((d) => (d.trim() ? `${merged}\n${d}` : merged));
            }
          };
          fireNow(0);
        }, 450) };
        coalesce.current = entry;
        return;
      }
      sendNow(text, false);
    };
    const sendNow = (text: string | undefined, fromBox: boolean): boolean => {
      if (submitting || sendLock.current) return false;
      sendLock.current = true;
      rejectedRef.current = false;
      setSubmitting(true);
      // QA 10:21: a status in the same tick as send on every path (taps, "I've read it", long
      // multi-part messages), not only the ones that look like a lookup.
      const said = (text ?? draftAnswer).trim();
      if (said) setAsideBusy(statusFor(said));
      void (stanceMode ? submitStanceAnswer(text) : submitAnswer(text ? { text } : undefined)).finally(() => {
        sendLock.current = false;
        setSubmitting(false);
        setAsideBusy(null);
        setPendingSaid(null);
        const queuedNext = queuedRef.current;
        if (queuedNext) {
          // The queued message goes right after the reply. If the first was turned back (too short),
          // both go together as one answer, so neither is lost.
          queuedRef.current = null;
          // QA 3:26 AM #4: a turned-back filler send never merges into the next one.
          const merged = fromBox && rejectedRef.current && withoutFiller(text ?? "") ? `${withoutFiller(text ?? "")}\n${queuedNext}` : queuedNext;
          // QA 3:51: the screen may not have re-rendered yet (a heavy render can take longer than a
          // beat), so a send that is still "busy" is retried, never silently dropped. It stays on
          // screen as queued until it actually goes.
          const fire = (n: number) => {
            const went = latestSendNow.current?.(merged, true);
            if (went === false && n < 80) {
              setTimeout(() => fire(n + 1), 75);
              return;
            }
            // Still nowhere to send it after ~6 s: back in the box, never lost.
            if (went === false) setDraftAnswer((d) => (d.trim() ? `${merged}\n${d}` : merged));
            setQueuedSaid(null);
          };
          setTimeout(() => fire(0), 60);
          return;
        }
        // Turned back: their words go back in the box, never lost.
        // QA 3:06: a short early take stays in the chat (and counts toward the next send), not back in the box.
        if (fromBox && rejectedRef.current && text && withoutFiller(text) && !stanceMode) setDraftAnswer((d) => (d.trim() ? (d.includes(text) ? d : `${text}\n${d}`) : text));
      });
      return true;
    };
    // A message queued during her reply goes to whatever she's asking now (the story question too).
    latestSendNow.current =
      screen === "story"
        ? (t: string) => void submitOwnStory(t)
        : screen === "gate"
          ? (t: string) => setGateSaid((prev) => [...prev, { id: Date.now(), said: t }].slice(-6))
          : // QA 3:51: between steps (the last question answered, the early take not up yet) there is
            // nothing to take it, so wait for the next step instead of losing it.
            (t: string, fromBox: boolean) => (!stanceMode && !coachingPlan[qIndex] ? false : sendNow(t, fromBox));
    const sparkHere = q && sparks[q.id] ? { qid: q.id, ...sparks[q.id]! } : null;
    const sparkFor = (qid: string) =>
      sparks[qid] ? (
        <SparkExchange inline turn={sparks[qid]!} active={false} onYes={() => {}} onNo={() => {}} onOff={() => {}} />
      ) : null;
    const answerSpark = async () => {
      if (!q) return;
      updateSpark(q.id, { status: "loading" });
      let questions: string[] | undefined;
      try {
        const res = await fetch(`/api/papers/${paperId}/intake/spark`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: q.id,
            questionText: q.text.slice(0, 600),
            questionKind: q.kind,
            // QA 11:40 #4: no spark question about material they haven't read.
            unread: (Boolean(brief?.northstar) && !caughtUp && !isPreparedSaying(materialAnswerNow)) || undefined,
            topic: (requirements.promptQuestion.value || requirements.topic.value || "").slice(0, 500) || undefined,
            interests: ["interest_1", "interest_2"]
              .map((id) => answerFor(id).slice(0, 200))
              .filter(Boolean),
          }),
        });
        if (res.ok) questions = ((await res.json()) as { questions?: string[] }).questions;
      } catch {
        /* fall through */
      }
      updateSpark(q.id, {
        status: "shown",
        questions: questions?.length
          ? questions
          : ["What's the first thing that comes to mind when you think about this topic?", "Where have you run into this in your own life?"],
      });
    };
    // Only Pau's own spoken sentences go to read-aloud.
    const currentTurnTexts: string[] = q && !(decisionSaving && q.id === "decision_pick")
      ? [
          editing
            ? `Sure, change anything and send it again. ${q.text}`
            : stanceMode
              ? `Last one before the stance interview. ${q.text}`
              : q.text,
        ]
      : screen === "story"
        ? ["Here are a few directions your paper could take, built from what you told me."]
        : screen === "gate"
          ? [
              "That's everything for Stage 1. Ready for the stance interview?",
              ...(metrics && voiceWordsMet && readyVoiceLine(voiceEval.totalWords) ? [readyVoiceLine(voiceEval.totalWords) as string] : []),
            ]
          : [];
    // PC-29 QA round 2: what the call says is the copy this turn shows, word for word.
    voiceLineRef.current = [
      error ?? "",
      screen === "story"
        ? informedStory
          ? informedStoryAsk(informedLeader)
          : "Here are a few directions your paper could take, built from what you told me. Tap one, or write your own angle below."
        : [screen === "coaching" ? teachSpoken : "", ...currentTurnTexts].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    // Leads fold into Pau's CURRENT turn (PLAN.md 9): her intro, the links, then the question. Never a separate bubble.
    const leadsShown = leads.length > 0 && (screen === "coaching" || screen === "gate") && !stanceMode;
    const leadsList = leadsShown ? (
      <ul key="leads" className="space-y-3" aria-label="Research leads" data-leads>
                {leads.map((lead) => (
                  <li key={lead.name} className="rounded-[8px] border border-ds-border bg-ds-page p-3 text-[16px]">
                    <p className="font-semibold">{lead.name}</p>
                    <p className="text-ds-muted">{lead.whyAssignment}</p>
                    {lead.whyInterest ? <p className="text-ds-muted">{lead.whyInterest}</p> : null}
                    <ul className="mt-1 flex flex-wrap gap-x-4" aria-label={`Look for: ${lead.name}`}>
                      {leadLinks(lead, requirements?.topic.value || requirements?.promptQuestion.value).map((link) => (
                        <li key={link.kind}>
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-lead-link={link.kind}
                            className={`inline-flex min-h-[48px] items-center ${dsLink}`}
                          >
                            {link.label}
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    <DsButton type="button" size="sm" variant="secondary" className="mt-1" onClick={() => acceptLead(lead)}>
                      Add as a lead
                    </DsButton>
                  </li>
                ))}
              </ul>
    ) : null;
    const leadsBubbles = leadsShown ? [LEADS_INTRO, leadsList] : [];
    const threadSpeak: SpeakItem[] = [
      ...introBubbles.map((text, i) => ({ key: `intro:${i}`, text })),
      ...coachingPlan.slice(0, reach).map((item) => ({ key: `q:${item.id}`, text: item.text })),
      ...(storyAngle || screen === "story"
        ? [{ key: "story:intro", text: "Here are a few directions your paper could take, built from what you told me.", turn: screen === "story" }]
        : []),
      // Leads: voice reads only Pau's intro, never the links or lead cards; spoken before the question it rides with.
      ...(leadsShown ? [{ key: "leads:intro", text: LEADS_INTRO }] : []),
      ...(q ? [{ key: editing ? `edit:${editSeq}:${q.id}` : `q:${q.id}`, text: currentTurnTexts[0]!, turn: true }] : []),
      ...(screen === "story" && editing
        ? [{ key: `edit:${editSeq}:story`, text: "Here are a few directions your paper could take, built from what you told me.", turn: true }]
        : []),
      ...(screen === "gate" ? [{ key: "gate", text: currentTurnTexts.join(" "), turn: true }] : []),
      ...(sparkHere ? [{ key: `spark-offer:${sparkHere.qid}`, text: SPARK_OFFER }] : []),
      ...(sparkHere?.status === "declined" ? [{ key: `spark-reply:${sparkHere.qid}`, text: SPARK_DECLINED }] : []),
      ...(sparkHere?.status === "off" ? [{ key: `spark-reply:${sparkHere.qid}`, text: SPARK_OFF }] : []),
      ...(sparkHere?.questions ?? []).map((text, i) => ({ key: `spark:${sparkHere!.qid}:${i}`, text })),
      ...(error && (MORE_WORDS_NOTE.test(error) || /^Tell me a little/.test(error)) ? [{ key: `err:${error}`, text: error }] : []),
    ].filter((i, idx, all) => i.text && all.findIndex((j) => j.key === i.key) === idx);

    const lastMaterialTurn = confirmTurns.reduce((last, t, i) => (t.role === "pau" && (t as { material?: boolean }).material ? i : last), -1);
    return (
      <div className="mx-auto max-w-[680px]">
        <SpeakNew scope={paperId} items={rtMode ? [] : threadSpeak} />
        <ChatHeader eyebrow="Stage 1 · Intake" eyebrowClassName={dsEyebrow} hideVoice={hideReadAloud} />
        {focusTools}
        <div className="mt-4 space-y-4" aria-label="Conversation with Pau" role="log">
          {/* PC-28: on a return, the one opener first; earlier turns stay in "Past chat". */}
          <FocusOpener line={welcomeLine} scope={paperId} signal={`${screen}:${qIndex}:${answers.length}:${confirmTurns.length}`} silent={rtMode} onProgress={() => setPanel("skeleton")} />
          {/* The start of the chat, rebuilt from what's saved. */}
          {snap ? null : <PauPauGroup showName bubbles={[ASSIGNMENT_GREETING, ASSIGNMENT_ASK]} />}
          {sentMessage && !snap ? <StudentBubble message={sentMessage} /> : null}
          {snap ? null : confirmTurns.length ? (
            confirmTurns.map((t, i) =>
              t.role === "student" ? (
                <StudentBubble key={`ct${i}`} message={{ text: t.text, files: [], at: 0 }} />
              ) : (
                <Fragment key={`ct${i}`}>
                  <PauPauGroup bubbles={t.paras} />
                  {/* QA 10:21 walk A: the key points shown before the confirm stay on the page after it. */}
                  {i === lastMaterialTurn && brief && (brief.summary || brief.summaries?.length) ? (
                    <div data-confirm-material>
                      <MaterialBubbles brief={brief} paperId={paperId} darkWebOk={false} lead="" />
                    </div>
                  ) : null}
                </Fragment>
              ),
            )
          ) : (
            <PauPauGroup bubbles={readBackParas(requirements, { seed: paperId })} />
          )}

          {coachingPlan.map((item, i) => {
            const said = answerFor(item.id);
            if (!said && i >= reach) return null;
            const isCurrent = q?.id === item.id;
            if (isCurrent && !editing) return null;
            // PC-28: answered before this return: saved, shown in "Past chat", not here.
            if (snap?.answered.has(item.id) && !isCurrent) return null;
            return (
              <div key={item.id} className="space-y-4">
                {/* The first question comes in the same reply as the intro. */}
                <PauPauGroup bubbles={i === 0 ? [...introBubbles, item.text] : [item.text]}>
                  {isCurrent ? null : sparkFor(item.id)}
                </PauPauGroup>
                {said && offerReply[item.id]
                  ? qaAsides
                      .filter((x) => x.qid === item.id)
                      .map((x) => (
                        <div key={x.id} className="space-y-4" data-past-aside>
                          <StudentBubble message={{ text: x.said, files: [], at: 0 }} />
                          <PauPauGroup bubbles={x.paras} />
                        </div>
                      ))
                  : null}
                <EchoBubble
                  text={
                    // QA: messages sent before the answer (turned back as "doesn't count yet") stay on
                    // screen with it, as one turn, instead of vanishing once the answer lands.
                    said && !offerReply[item.id] && qaAsides.some((x) => x.qid === item.id && x.filler)
                      ? [...qaAsides.filter((x) => x.qid === item.id && x.filler).map((x) => x.said), said].join("\n")
                      : (said && offerReply[item.id]) || said || "Skipped"
                  }
                  chatText={(said && offerReply[item.id]) || said || "Skipped"}
                  muted={!said}
                  editing={isCurrent}
                  onEdit={() => editAnswer(i)}
                  editLabel={said ? `Edit your answer to: ${item.text}` : `Answer this one now: ${item.text}`}
                />
                {item.id === "material_check" && brief && (brief.lostAtStart || materialLost(said)) ? (
                  <MaterialBubbles brief={brief} paperId={paperId} lead={lostLead({ concept: brief.options?.concept, ask: brief.readback?.ask, hasSummary: Boolean(brief.summary || brief.summaries?.length) })} />
                ) : null}
                {item.id === "material_check" && summaryBusy && !asideBusy ? (
                  <>
                    {/* The reassurance and the core idea show right away (QA 1:16); the summary follows when it's ready. */}
                    {brief && !(brief.summary || brief.missingAsk) ? (
                      <PauPauGroup bubbles={[lostLead({ concept: brief.options?.concept, ask: brief.readback?.ask }).replace(/ Here's a summary[^]*$/, " Give me a moment to pull together the key ideas from your professor's sources.")]} />
                    ) : null}
                    <ReadingBubble status="Digging it up… pulling together the key points." startedAt={Date.now()} />
                  </>
                ) : null}
              </div>
            );
          })}

          {/* North star: their decision above IS the direction (QA 7:02 AM: never a second "Which direction…?"). */}
          {storyAngle && screen !== "story" && !storyFromDecision && !(brief?.northstar && brief.decision) && !snap?.story ? (
            <div className="space-y-4">
              <PauPauBubble showName={false}>Which direction do you want to take your paper?</PauPauBubble>
              {storyAngle.source === "student" ? (
                <EchoBubble
                  text={storyAngle.text}
                  onEdit={() => editAnswer("story")}
                  editLabel="Change your story angle"
                />
              ) : (
                <PickedChip
                  label={shortLabel(storyAngle.text)}
                  fullText={storyAngle.text}
                  onEdit={() => editAnswer("story")}
                  editLabel="Change your story angle"
                />
              )}
            </div>
          ) : null}
          {stanceAnswer && !(stanceMode && !editing) && !snap?.answered.has("stance_early") ? (
            <div className="space-y-4">
              <PauPauGroup bubbles={[stanceText]}>{stanceMode ? null : sparkFor("stance_early")}</PauPauGroup>
              <EchoBubble
                text={stanceAnswer}
                editing={stanceMode}
                onEdit={() => editAnswer("stance")}
                editLabel="Edit your early take"
              />
            </div>
          ) : null}

          {q && reoffer === q.id && brief && (brief.summary || brief.missingAsk) ? (
            <MaterialBubbles brief={brief} paperId={paperId} darkWebOk={false} lead="No worries. Here's what I've got again. Take a look, then answer in your own words." />
          ) : null}
          {/* QA 11:08 (lost-path order): her Stage 1 intro came first, so it stays above her replies to the first question. */}
          {introAbove ? <PauPauGroup bubbles={introBubbles} /> : null}
          {/* Questions and pastes she answered in place for this question (never saved as answers). */}
          {q
            ? qaAsides
                .filter((a) => a.qid === q.id && !snap?.asides.has(a.id))
                .map((a) => (
                  <div key={a.id} className="space-y-4" data-interview-aside>
                    <StudentBubble message={{ text: a.said, files: [], at: 0 }} />
                    <PauPauGroup bubbles={a.paras} />
                  </div>
                ))
            : null}
          {pendingSaid ? (
            <div data-pending-said>
              <StudentBubble message={{ text: pendingSaid, files: [], at: 0 }} />
            </div>
          ) : null}
          {/* QA 1:16 (lag): a lost student is reassured and taught the core idea right away, while the summary loads. */}
          {asideBusy?.startsWith("Digging it up… pulling") && !pendingSaid && brief && !(brief.summary || brief.missingAsk) ? (
            <PauPauGroup bubbles={[lostLead({ concept: brief.options?.concept, ask: brief.readback?.ask }).replace(/ Here's a summary[^]*$/, " Give me a moment to pull together the key ideas from your professor's sources.")]} />
          ) : null}
          {asideBusy ? <ReadingBubble status={asideBusy} startedAt={Date.now()} /> : null}
          {queuedSaid ? (
            <div data-queued-said>
              <StudentBubble message={{ text: queuedSaid, files: [], at: 0 }} />
              <p className="mt-1 text-right text-[13px] leading-[1.5] text-ds-muted" role="status">Sends as soon as Pau replies.</p>
            </div>
          ) : null}
          {/* QA 11:21: never the style question while an informed answer's decision is still saving (an in-between plan). */}
          {/* Pau's current turn. */}
          {q && !(decisionSaving && q.id === "decision_pick") ? (
            <PauPauGroup
              bubbles={[
                ...(!editing && q.id === coachingPlan[0]?.id && !introAbove ? introBubbles : []),
                editing
                  ? recovering
                    ? "One thing before the stance interview: I still need the reason behind your pick. One or two sentences is plenty."
                    : "Sure, change anything and send it again."
                  : null,
                ...leadsBubbles,
                ...(informedLead && !editing && q.id !== "material_check" ? informedLead : []),
                stanceMode && !editing ? "Last one before the stance interview." : null,
                q.text,
              ].filter((b) => Boolean(b))}
              headingIndex={
                (!editing && q.id === coachingPlan[0]?.id && !introAbove ? introBubbles.length : 0) +
                (editing ? 1 : 0) +
                leadsBubbles.length +
                (informedLead && !editing && q.id !== "material_check" ? informedLead.length : 0) +
                (stanceMode && !editing ? 1 : 0)
              }
              headingId="coach-question"
            >
              {q.id === "material_check" ? (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Quick answers">
                    {catchUpOffer === q.id ? (
                      <>
                        <DsButton type="button" size="sm" disabled={submitting} data-catchup-yes onClick={() => send("Yes, catch me up on the key points")}>
                          Yes, catch me up
                        </DsButton>
                        <DsButton type="button" size="sm" variant="secondary" disabled={submitting} data-catchup-no onClick={() => send("No thanks, let's pick a direction")}>
                          No thanks, let&apos;s pick
                        </DsButton>
                      </>
                    ) : null}
                    {["I haven't read it yet", "I've read it"].map((choice) => (
                      <DsButton key={choice} type="button" size="sm" variant="secondary" disabled={submitting} onClick={() => send(choice)}>
                        {choice}
                      </DsButton>
                    ))}
                    <DsButton type="button" size="sm" variant="secondary" onClick={() => setReadingOpen((v) => !v)}>
                      Add a reading
                    </DsButton>
                  </div>
                  {readingTools}
                </div>
              ) : q.id === "decision_pick" && brief?.options?.options.length ? (
                <div className="space-y-2 pt-1">
                {catchUpOffer === q.id ? (
                  <DsButton type="button" size="sm" variant="secondary" disabled={submitting} data-catchup-offer onClick={() => void catchUpNow(q.id)}>
                    Catch me up on the reading first
                  </DsButton>
                ) : null}
                <div className="flex flex-wrap gap-2" role="group" aria-label="Options">
                  {brief.options.options.slice(0, 3).map((o) => (
                    <DsButton
                      key={o.label}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setDraftAnswer((d) => (d.trim() ? d : `I'd pick ${o.label} because `))}
                    >
                      {o.label}
                    </DsButton>
                  ))}
                  {brief.missing?.length ? (
                    <DsButton type="button" size="sm" variant="secondary" onClick={() => setReadingOpen((v) => !v)}>
                      Add a reading
                    </DsButton>
                  ) : null}
                </div>
                {readingTools}
                </div>
              ) : q.id === "leader_pick" && brief?.options?.people?.length ? (
                <div className="space-y-1 pt-1">
                  {/* QA 7:02 AM: the prefill is the start of THEIR sentence; say so, and put the cursor at its end. */}
                  <p className={dsCaption} data-leader-hint>
                    Tap one, then finish the sentence with your reason.
                  </p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Leaders">
                    {brief.options.people.map((o) => (
                      <DsButton
                        key={o.label}
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setDraftAnswer((d) => (d.trim() ? d : `I'd go with ${o.label} because `));
                          setTimeout(() => {
                            const all = document.querySelectorAll<HTMLTextAreaElement>("textarea");
                            const ta = all[all.length - 1];
                            if (!ta) return;
                            ta.focus();
                            ta.setSelectionRange(ta.value.length, ta.value.length);
                          }, 0);
                        }}
                      >
                        {o.label}
                      </DsButton>
                    ))}
                  </div>
                </div>
              ) : q.kind === "background" ? (
                <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Quick answers">
                  {["Not comfortable yet", "Somewhat comfortable", "Comfortable"].map((choice) => (
                    <DsButton
                      key={choice}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={submitting}
                      onClick={() => send(choice)}
                    >
                      {choice}
                    </DsButton>
                  ))}
                </div>
              ) : null}
              {isInterest && q.id === "interest_1" ? (
                <p className="text-[13px] leading-[1.6] text-ds-muted">
                  Optional. I use this only to steer research leads toward things you enjoy.
                </p>
              ) : null}
              {stanceMode ? <p className="text-[13px] leading-[1.6] text-ds-muted">{EARLY_STANCE_MIN_NOTE}</p> : null}
              {sparkHere ? (
                <SparkExchange
                  inline
                  turn={sparkHere}
                  active
                  onYes={() => void answerSpark()}
                  onNo={() => updateSpark(sparkHere.qid, { status: "declined" })}
                  onOff={() => {
                    setChatPref("sparkOff", true);
                    updateSpark(sparkHere.qid, { status: "off" });
                  }}
                />
              ) : null}
              <ReplayButton texts={currentTurnTexts} className="-ml-2" />
            </PauPauGroup>
          ) : null}

          {leadsShown && screen === "coaching" && !q ? <PauPauGroup bubbles={leadsBubbles} /> : null}

          {sparkHere && !q ? (
            <SparkExchange
              turn={sparkHere}
              active
              onYes={() => void answerSpark()}
              onNo={() => updateSpark(sparkHere.qid, { status: "declined" })}
              onOff={() => {
                setChatPref("sparkOff", true);
                updateSpark(sparkHere.qid, { status: "off" });
              }}
            />
          ) : null}

          {screen === "story" && informedStory ? (
            // QA 1:16: an informed student never gets generic angle cards: the affirmation, the
            // checklist, then ONE concrete question about their own example (answered below).
            <PauPauGroup
              bubbles={[...(informedLead ?? []), informedStoryAsk(informedLeader)]}
              headingIndex={(informedLead ?? []).length}
              headingId="story-ask"
            />
          ) : screen === "story" ? (
            <PauPauGroup
              bubbles={[
                "Here are a few directions your paper could take, built from what you told me.",
                <ul key="angles" className="space-y-2" aria-label="Story angles">
                  {storyAngles.map((angle) => (
                    <li key={angle.id}>
                      <button
                        type="button"
                        disabled={Boolean(pickingStory)}
                        aria-busy={pickingStory === angle.id}
                        onClick={() => void pickStory(angle)}
                        className={cn(
                          "ds-focus w-full rounded-[8px] border bg-ds-page px-4 py-3 text-left transition-colors duration-150 hover:border-ds-accent disabled:cursor-not-allowed",
                          pickingStory === angle.id ? "border-ds-accent" : "border-ds-border",
                        )}
                      >
                        <span className="block text-[16px] font-semibold leading-[1.5] text-ds-ink">
                          {angle.question}
                        </span>
                        <span className="mt-1 block text-[14px] leading-[1.5] text-ds-muted">
                          {pickingStory === angle.id ? "Saving your pick…" : angle.whyFits}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>,
                "Tap one, or write your own angle below. You can change it later.",
              ]}
              headingIndex={0}
              headingId="story-ask"
            />
          ) : null}


          {screen === "gate" ? (
            <PauPauGroup
              bubbles={[
                ...leadsBubbles,
                "That's everything for Stage 1. Ready for the stance interview?",
                metrics && voiceWordsMet && readyVoiceLine(voiceEval.totalWords)
                  ? readyVoiceLine(voiceEval.totalWords)
                  : null,
                gateChecks,
                voiceShortNote({ voiceOk: voiceWordsMet }) || null,
              ].filter((b) => b !== null)}
              headingIndex={leadsBubbles.length}
              headingId="gate-ask"
            >
              <div className="pt-2">
                <DsButton
                  type="button"
                  variant="primary"
                  disabled={startingStance || blockers.length > 0}
                  onClick={() => void completeStage1()}
                >
                  {startingStance ? "Starting the stance interview…" : "Start stance interview"}
                </DsButton>
                {blockers.map((reason) => (
                  <p key={reason} className="mt-2 text-[13px] leading-[1.6] text-ds-muted" role="status">
                    {reason}
                  </p>
                ))}
                {snap ? (
                  <p className="mt-2 text-[13px] leading-[1.6] text-ds-muted">
                    Want to change something?{" "}
                    <button type="button" className="font-semibold text-ds-ink underline underline-offset-4" data-show-answers onClick={focus.unfocus}>
                      Show my answers
                    </button>{" "}
                    and tap the one to change.
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] leading-[1.6] text-ds-muted">
                    Want to change something? Tap any of your answers above.
                  </p>
                )}
                {rtMode ? (
                  <div className="mt-3">
                    {/* PC-29 QA minor: Stage 1 is done here; say what voice is waiting for (no text box). */}
                    <RealtimeControls
                      call={rt}
                      listenHint={startingStance ? "Starting the stance interview…" : blockers.length ? "Voice is on. Tap an answer above to change it." : "Say “yes” or tap Start stance interview."}
                    />
                  </div>
                ) : null}
              </div>
            </PauPauGroup>
          ) : null}
          {screen === "gate"
            ? gateSaid.slice(snap?.gateSaid ?? 0).map((g) => (
                <div key={g.id} className="space-y-4" data-gate-said>
                  <StudentBubble message={{ text: g.said, files: [], at: 0 }} />
                  <PauPauGroup bubbles={[GATE_SAID_REPLY]} />
                </div>
              ))
            : null}

          {rt.on ? <LiveTurns rows={rt.live} /> : null}
          {error && shortEcho ? <StudentBubble message={{ text: shortEcho, files: [], at: 0 }} /> : null}
          {error ? (
            <PauPauBubble showName={false} live>
              <span role="alert">{error}</span>
            </PauPauBubble>
          ) : null}
        </div>

        {screen === "gate" ? null : (
          <ComposerDock>
            {/* QA 5:46: ONE composer for every Stage 1 step (story box included), so the textarea is never
                remounted mid-session and nothing typed right after an Enter is lost. */}
            <ChatComposer
              paperId={paperId}
              labelledBy={screen === "story" ? "story-ask" : "coach-question"}
              value={screen === "story" ? ownStory : draftAnswer}
              onChange={(next) => {
                if (screen === "story") {
                  pasteMeta.onChange(ownStory, next);
                  setOwnStory(next);
                } else {
                  pasteMeta.onChange(draftAnswer, next);
                  setDraftAnswer(next);
                }
              }}
              onPaste={pasteMeta.onPaste}
              inputProps={{
                onDrop: pasteMeta.onDrop,
                onBeforeInput: pasteMeta.onBeforeInput,
                "aria-busy": (screen !== "story" && restoringDraft) || undefined,
              }}
              minRows={1}
              sending={screen === "story" ? pickingStory === "own" : submitting}
              onQueue={screen === "story" ? undefined : () => send()}
              sendLabel="Send"
              placeholder={
                screen === "story"
                  ? "Or write your own angle as a question"
                  : restoringDraft && !draftAnswer
                    ? "Restoring your draft…"
                    : PLACEHOLDERS[q?.id ?? ""] ?? "Tell me in your own words"
              }
              onSend={screen === "story" ? () => void submitOwnStory() : () => send()}
              realtimeSlot={rtMode ? <RealtimeControls call={rt} /> : undefined}
            />
            {minNote ? (
              // Floats above the box (QA 4:42 #1): typing never changes the dock's height.
              <p
                className="pointer-events-none absolute inset-x-4 bottom-full mb-1 rounded-[8px] border border-ds-border bg-ds-surface px-3 py-2 text-[13px] leading-[1.6] text-ds-muted shadow-ds-card sm:inset-x-0"
                role="note"
                data-min-note
              >
                {minNote}
              </p>
            ) : null}
            {/* Fixed height whatever the screen shows here (Skip, Saving…, the voice meter). */}
            <div className="mt-1 flex h-[48px] items-center justify-between gap-x-4 overflow-hidden text-[13px] leading-[1.6] text-ds-muted" data-dock-footer>
              <div className="flex min-w-0 flex-1 items-center gap-x-1 overflow-x-auto whitespace-nowrap">
                {editing ? (
                  <button
                    type="button"
                    className="ds-focus min-h-[48px] px-2 font-semibold underline-offset-4 hover:underline"
                    onClick={() => returnFromEdit(answers)}
                  >
                    Cancel edit
                  </button>
                ) : screen === "coaching" && !stanceMode ? (
                  <>
                    {/* QA 1:11 AM minor: no Skip on a question Stage 1 needs (it would only bounce back). */}
                    {q && STAGE1_REQUIRED_QS.includes(q.id) ? null : (
                      <button
                        type="button"
                        disabled={submitting}
                        className="ds-focus min-h-[48px] px-2 font-semibold underline-offset-4 hover:underline"
                        onClick={() => void submitAnswer({ skip: true })}
                      >
                        Skip
                      </button>
                    )}
                    {isInterest ? (
                      <button
                        type="button"
                        className="ds-focus min-h-[48px] px-2 underline-offset-4 hover:underline"
                        onClick={skipInterest}
                      >
                        Skip the get-to-know-you questions
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
              <p className="flex shrink-0 items-center gap-2 whitespace-nowrap px-2">
                {restoringDraft && !draftAnswer ? <span role="status">Restoring your draft… </span> : null}
                {submitting ? <span role="status">Saving… </span> : null}
                {isVoiceQuestion || stanceMode ? (
                  <span
                    className="inline-flex items-center gap-1"
                    title="Your voice sample: how much of your own writing Pau has so far"
                  >
                    <span className="sr-only">{`Voice sample: ${voiceEval.totalWords} of ${STAGE1_VOICE_MIN_WORDS} words`}</span>
                    <span aria-hidden className="h-1 w-10 overflow-hidden rounded-full bg-ds-border">
                      <span
                        className="block h-full bg-ds-sage"
                        style={{ width: `${Math.min(100, (voiceEval.totalWords / STAGE1_VOICE_MIN_WORDS) * 100)}%` }}
                      />
                    </span>
                    <span aria-hidden>{voiceWordsMet ? "Voice ✓" : "Voice"}</span>
                  </span>
                ) : null}
                <SaveStatus status={draftStatus} />
              </p>
            </div>
          </ComposerDock>
        )}
        <ScrollToNewest
          signal={`${screen}:${qIndex}:${answers.length}:${storyAngles.length}:${editing ? 1 : 0}:${error ?? ""}:${sparkHere?.status ?? ""}`}
        />
      </div>
    );
  }

  return null;
}

function CardField({
  label,
  attention,
  confirmed,
  children,
}: {
  label: string;
  attention?: boolean;
  confirmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[12px] border p-6 ${
        attention && !confirmed
          ? "border-[rgba(212,160,23,0.5)] bg-[rgba(212,160,23,0.08)]"
          : "border-ds-border bg-ds-surface"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-[16px] font-semibold leading-[1.2] text-ds-ink">{label}</p>
        {confirmed ? (
          <span className="inline-flex items-center gap-1 text-[13px] leading-[1.6] text-ds-muted">
            <Check className="h-4 w-4 text-ds-sage" aria-hidden />
            Confirmed
          </span>
        ) : attention ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-ds-ink">
            <span className="h-2 w-2 rounded-full bg-ds-amber" aria-hidden />
            Needs a look
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function FieldActions({
  onNotSpecified,
  onViewSource,
}: {
  onLooksRight?: () => void;
  onNotSpecified?: () => void;
  onViewSource?: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {onNotSpecified ? (
        <DsButton type="button" size="sm" variant="ghost" onClick={onNotSpecified}>
          Not specified
        </DsButton>
      ) : null}
      {onViewSource ? (
        <DsButton type="button" size="sm" variant="ghost" onClick={onViewSource}>
          View source
        </DsButton>
      ) : null}
    </div>
  );
}

function sourceAction(
  field: Field<unknown>,
  label: string,
  setViewSource: (v: { label: string; excerpt: string } | null) => void,
) {
  const excerpt =
    field.provenance?.excerpt ||
    field.rawEvidence ||
    "";
  if (!excerpt) return undefined;
  return () => setViewSource({ label, excerpt });
}

/** One list item per line. Trim only when parsing, never in the box itself. */
function splitListLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * A list textarea that keeps exactly what the student typed (spaces, blank
 * new lines) and hands the raw text up. It only takes the parent's value when
 * that value means something different from the box, e.g. "Not specified".
 */
function ListTextarea({ value, onChange }: { value: string; onChange: (raw: string) => void }) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (splitListLines(text).join("\n") !== splitListLines(value).join("\n")) setText(value);
  }
  return (
    <Textarea
      className={dsTextarea}
      rows={2}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}
