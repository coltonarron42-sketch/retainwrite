"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DsButton } from "@/components/ui/ds-button";
import { asQuestion, isQuestionTopic, topicMidSentence } from "@/lib/copy/topic-phrase";
import { PauPauConfirm } from "@/components/stages/stage1/pau-pau-confirm";
import { COACH_NAME } from "@/lib/stage1/pau-pau";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  UploadPanel,
  extractStagedFile,
  type StagedAssignmentFile,
} from "@/components/stages/stage1/upload-panel";
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
import { canStartAssignmentParse } from "@/lib/assignment/can-start-parse";
import { formatLengthLabel } from "@/lib/assignment/pages-to-words";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import { UNREADABLE_ASSIGNMENT } from "@/lib/papers/account";
import { parseLinkField } from "@/lib/assignment/provided-sources";
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
import { createLead, type ResearchLeadDraft } from "@/lib/stage1/leads";
import { buildStoryAngleFallback } from "@/lib/stage1/story-angles";
import {
  evaluateStage1VoiceMinimum,
  readyVoiceLine,
  tallyVoiceWords,
  type VoiceAnswer,
} from "@/lib/stage1/voice";
import { usePasteMeta } from "@/lib/hooks/use-paste-meta";
import { persistField } from "@/lib/papers/persist";
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
} from "@/lib/stage1/intake-resume";
import { computeStyleMetrics } from "@/lib/style/metrics";
import { cn, wordCount } from "@/lib/utils";
import { Check } from "lucide-react";
import { dsEyebrow, dsH1, dsInput, dsSelect, dsTextarea } from "@/lib/ds/classes";

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
  const [links, setLinks] = useState("");
  const [rightsOk, setRightsOk] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedAssignmentFile[]>([]);
  const [parseStatus, setParseStatus] = useState("Extracting the text…");
  const [parseSeconds, setParseSeconds] = useState(0);
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
  const [skippedInterest, setSkippedInterest] = useState(false);
  const [needFallback, setNeedFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPolicyAck, setAiPolicyAck] = useState(false);
  const [followupAsked, setFollowupAsked] = useState(false);
  const [checklistConfirmed, setChecklistConfirmed] = useState(false);
  /** The field-by-field editor behind Pau Pau's "Fix something". */
  const [editingDetails, setEditingDetails] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [startingStance, setStartingStance] = useState(false);
  const [storyAngles, setStoryAngles] = useState<StoryAngle[]>([]);
  const [storyAngle, setStoryAngle] = useState<{
    text: string;
    source: "ai" | "student";
  } | null>(null);
  const [ownStory, setOwnStory] = useState("");
  const [writingOwnStory, setWritingOwnStory] = useState(false);
  /** Which story is being saved: an angle id, "own", or null. Shown right away. */
  const [pickingStory, setPickingStory] = useState<string | null>(null);
  /** True while a reload is still fetching the saved draft for the open question. */
  const [restoringDraft, setRestoringDraft] = useState(false);
  // Draft text for the resumed question, held until that question is open so
  // it is never shown (or autosaved) under a different question.
  const draftRestore = useRef<{ questionId: string; text: string; opened: boolean; serverDone: boolean } | null>(null);
  const [viewSource, setViewSource] = useState<{
    label: string;
    excerpt: string;
  } | null>(null);

  useEffect(() => {
    if (screen !== "parsing") return;
    const timer = window.setInterval(() => setParseSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    setPaper(accountPaper ?? getDemoPaper(paperId) ?? null);
    if (!resumeReady || !initialRequirements) return;
    setRequirements(initialRequirements);
    setRawText(initialRawText);
    if (initialRequirements.topic.confirmed || initialRequirements.promptQuestion.confirmed) {
      setChecklistConfirmed(true);
    }
    setScreen((current) => (current === "upload" ? "card" : current));
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
      .then((data: {
        answers?: IntakeAnswer[];
        storyAngle?: { text: string; source: "ai" | "student" } | null;
        resume?: { screen?: string | null; questionId?: string | null } | null;
      } | null) => {
        if (cancelled) return;
        if (!data) {
          setResumePending(false);
          setResumeReady(true);
          return;
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
          if (stanceOpen) setDraftAnswer(local?.text ?? savedStance);
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

  const coachingPlan = useMemo(() => {
    if (!requirements) return [] as { id: string; kind: IntakeAnswer["kind"]; text: string }[];
    const topic =
      requirements.topic.value ||
      requirements.promptQuestion.value ||
      "this assignment";
    const plan: { id: string; kind: IntakeAnswer["kind"]; text: string }[] = [];
    if (!skippedInterest) {
      INTEREST_Qs.forEach((q) =>
        plan.push({ id: q.id, kind: "interest", text: q.text }),
      );
    }
    plan.push({
      id: "bg_comfort",
      kind: "background",
      text: `How comfortable are you with ${requirements.citationStyle.value ?? "the required"} citations so far?`,
    });
    plan.push({
      id: "coaching_take",
      kind: "coaching",
      text: "In your own words, what do you think this assignment wants you to figure out?",
    });
    plan.push({
      id: "personal_1",
      kind: "personal",
      text: isQuestionTopic(topic)
        ? `When has the question “${asQuestion(topic)}” come up in real life — school, work, family, or something you follow? Write at least a few sentences.`
        : `When have you seen an idea like ${topicMidSentence(topic)} show up in real life — school, work, family, or something you follow? Write at least a few sentences.`,
    });
    // Early stance is asked after Pick your story (3.4a → stance on the angle).
    if (needFallback) {
      plan.push({
        id: "fallback_voice",
        kind: "fallback_voice",
        text: "Before we start the stance interview, write a little more in your own words — no editing. Why does this assignment matter to you, or what's a moment when you saw this idea in real life?",
      });
    }
    return plan;
  }, [requirements, skippedInterest, needFallback]);

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
      setQIndex(index);
      setScreen("coaching");
      const restore = draftRestore.current;
      if (restore && !restore.opened && coachingPlan[index]?.id === restore.questionId && restore.text) {
        setDraftAnswer(restore.text);
      }
    }
    settleRestore();
  }, [demoMode, answers, coachingPlan, storyAngle, needFallback, skippedInterest, resumeReady]);

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

  const earlyStance = answers.find((a) => a.questionId === "stance_early");
  const stanceOk = earlyStance ? wordCount(earlyStance.answerText) >= 25 : false;
  const cardGate = { ok: checklistConfirmed };

  if (!paper || resumePending) {
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
    const linkList = parseLinkField(links);
    if (!rightsOk) {
      setError("Confirm you're uploading this for your own coursework.");
      return;
    }
    const hasFiles = stagedFiles.length > 0;
    if (stagedFiles.some((f) => f.status === "reading")) {
      setError("Your files are still being read. Read my assignment unlocks when they finish.");
      return;
    }
    const fileTexts = stagedFiles
      .filter((f) => f.status === "ready")
      .map((f) => f.extractedText.trim())
      .filter(Boolean);
    const failedFiles = stagedFiles.filter((f) => f.status === "failed");
    if (failedFiles.length && !fileTexts.length && !paste.trim()) {
      setError(
        failedFiles.length === 1
          ? `We couldn't read ${failedFiles[0]!.filename}. Retry it, remove it, or add the assignment text below.`
          : "We couldn't read your files. Retry them, remove them, or add the assignment text below.",
      );
      return;
    }
    // Paste / links are optional. Files alone are enough to continue.
    if (!hasFiles && !paste.trim() && linkList.length === 0) {
      setError("Upload a file, add optional text, or add at least one link.");
      return;
    }

    setParseSeconds(0);
    setScreen("parsing");
    setParseStatus(
      "Reading the assignment…",
    );

    if (paste.trim() || linkList.length) {
      void fetch(`/api/papers/${paperId}/assignment/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pasteText: paste.trim() || undefined,
          links: linkList.length ? linkList : undefined,
          extractionMethod: paste.trim() ? "paste" : "manual",
        }),
      }).catch(() => undefined);
    }
    if (!demoMode) void storeOriginals(paperId, stagedFiles);

    const combined = [
      ...fileTexts,
      paste.trim(),
      ...linkList.map((u) => `[Link provided]: ${u}`),
    ]
      .filter(Boolean)
      .join("\n\n");

    // SOP: coaching only, never generate submission text
    if (combined.trim()) {
      try {
        const res = await fetch(`/api/papers/${paperId}/assignment/parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ corpusText: combined }),
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
    setScreen("coaching");
    setQIndex(0);
    setDraftAnswer("");
    pasteMeta.reset();
  }

  function skipInterest() {
    setSkippedInterest(true);
    setAnswers((prev) => answersAfterSkippingInterest(prev));
    setDraftAnswer("");
    const rest = coachingPlan.filter((question) => question.kind !== "interest");
    const answered = new Set(answers.map((answer) => answer.questionId));
    const next = rest.findIndex((question) => !answered.has(question.id));
    setQIndex(next === -1 ? 0 : next);
  }

  function finishCoaching(nextAnswers: IntakeAnswer[]) {
    const phrases = nextAnswers
      .filter((a) => a.isVoiceSample && a.answerText.trim())
      .map((a) => a.answerText.trim());
    const topic =
      requirements?.topic.value ||
      requirements?.promptQuestion.value ||
      "this assignment";
    const angles =
      storyAngles.length > 0
        ? storyAngles
        : buildStoryAngleFallback({ topic, studentPhrases: phrases });
    setStoryAngles(angles);
    void fetch(`/api/papers/${paperId}/intake/story-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, studentPhrases: phrases }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { angles?: StoryAngle[] };
        if (data.angles?.length) setStoryAngles(data.angles);
      })
      .catch(() => undefined);
    setScreen("story");
  }

  async function submitAnswer(opts?: { skip?: boolean }) {
    const q = coachingPlan[qIndex];
    if (!q) {
      if (qIndex >= coachingPlan.length && coachingPlan.length > 0) {
        if (storyAngle) goToStanceOnStory();
        else finishCoaching(answers);
      }
      return;
    }
    const text = opts?.skip ? "" : draftAnswer.trim();
    if (!opts?.skip && !text && q.kind !== "background") {
      setError("Type an answer to continue, or skip this one.");
      return;
    }
    if (!opts?.skip && q.id === "stance_early" && wordCount(text) < 25) {
      setError("Your early take needs at least 25 words.");
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
    if (!demoMode && text) {
      const saved = await persistField(paperId, {
        fieldKey: `stage1:${q.id}`,
        text,
        submitted: true,
        resume: { stage: 1, questionId: q.id, screen: "coaching" },
      });
      if (!saved) {
        setError("Couldn't save that answer. It is still in the box.");
        return;
      }
      clearLocalDraft(paperId, `stage1:${q.id}`);
    }
    setAnswers(nextAnswers);
    setDraftAnswer("");
    setError(null);
    pasteMeta.reset();

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
      const tags = extractInterestTags(
        nextAnswers.filter((a) => a.kind === "interest").map((a) => a.answerText),
      );
      const suggested = [
        createLead({
          name: "A practitioner voice in this topic",
          whyAssignment:
            "Someone who has written or spoken about the same question your prompt asks.",
          scholarlyRequired: scholarly,
        }),
      ];
      if (tags[0]) {
        suggested.push(
          createLead({
            name: `A ${tags[0]}-adjacent example`,
            whyAssignment: "Connects to the assignment's required angle.",
            whyInterest: `Touches on your interest in ${tags[0]}.`,
            steeredBy: "both",
            scholarlyRequired: scholarly,
          }),
        );
      }
      setLeads(suggested);
    }

    if (qIndex + 1 < coachingPlan.length) {
      const nextQuestion = coachingPlan[qIndex + 1];
      setDraftAnswer(
        nextAnswers.find((answer) => answer.questionId === nextQuestion.id)?.answerText ?? "",
      );
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
    setDraftAnswer(savedAnswerText("stance_early"));
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
    goToStanceOnStory();
  }

  async function submitOwnStory() {
    const text = ownStory.trim();
    if (wordCount(text) < 15) {
      setError("Write at least 15 words for your own angle.");
      return;
    }
    if (pickingStory) return;
    setPickingStory("own");
    setStoryAngle({ text, source: "student" });
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
    setPickingStory(null);
    goToStanceOnStory();
  }

  async function submitStanceAnswer() {
    const text = draftAnswer.trim();
    if (wordCount(text) < 25) {
      setError("Your early take needs at least 25 words.");
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
      await fetch(`/api/papers/${paperId}/intake/next-question`, {
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
    setDraftAnswer("");
    pasteMeta.reset();
    setError(null);

    if (requirements && leads.length === 0) {
      const scholarly = !!requirements.requiredSources.value?.scholarlyRequired;
      const tags = extractInterestTags(
        nextAnswers.filter((a) => a.kind === "interest").map((a) => a.answerText),
      );
      const suggested = [
        createLead({
          name: "A practitioner voice in this topic",
          whyAssignment:
            "Someone who has written or spoken about the same question your prompt asks.",
          scholarlyRequired: scholarly,
        }),
      ];
      if (tags[0]) {
        suggested.push(
          createLead({
            name: `A ${tags[0]}-adjacent example`,
            whyAssignment: "Connects to the assignment's required angle.",
            whyInterest: `Touches on your interest in ${tags[0]}.`,
            steeredBy: "both",
            scholarlyRequired: scholarly,
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

  async function completeStage1() {
    if (!requirements || !paper || startingStance) return;
    if (!cardGate.ok) {
      setError("Confirm the assignment card first.");
      return;
    }
    if (!stanceOk) {
      setError("Save an early stance of at least 25 words.");
      return;
    }
    setStartingStance(true);

    try {
      const res = await fetch(`/api/papers/${paperId}/intake/complete`, {
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
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; reasons?: string[] };
        setError(data.reasons?.[0] ?? data.error ?? "Could not finish Stage 1.");
        setStartingStance(false);
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
    const canSubmit = canStartAssignmentParse({
      fileCount: stagedFiles.length,
      pasteText: paste,
      linkCount: parseLinkField(links).length,
      rightsOk,
    });
    const filesReading = stagedFiles.some((f) => f.status === "reading");
    const fileFailed = stagedFiles.some((f) => f.status === "failed");

    return (
      <div className="mx-auto max-w-[680px]">
        <p className={dsEyebrow}>
          Stage 1 · Intake
        </p>
        <h1 className={cn(dsH1, "mt-2")}>
          Start with the assignment
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-ds-muted">
          Upload the full prompt — files, photos from your library, or a camera
          shot of the handout. We&apos;ll pull out the requirements, and
          you&apos;ll check them before we ask any questions.
        </p>

        <div className="mt-8 space-y-6">
          <UploadPanel
            paperId={paperId}
            files={stagedFiles}
            onFilesChange={setStagedFiles}
            paste={paste}
            onPasteChange={setPaste}
            links={links}
            onLinksChange={setLinks}
            rightsOk={rightsOk}
            onRightsOkChange={setRightsOk}
            error={error}
            onError={setError}
            onRetryFile={(id) => void retryFile(id)}
          />
          <DsButton
            type="button"
            variant="primary"
            disabled={!canSubmit || filesReading || fileFailed}
            aria-busy={filesReading || undefined}
            aria-describedby={fileFailed ? "file-failed-hint" : undefined}
            onClick={() => void runParse()}
          >
            {filesReading ? "Reading your files…" : "Read my assignment"}
          </DsButton>
          {fileFailed && !filesReading ? (
            <p id="file-failed-hint" className="text-[13px] leading-[1.6] text-ds-muted">
              Retry or remove the file that couldn&apos;t be read to continue.
            </p>
          ) : null}
        </div>
        {demoMode ? (
          <p className="mt-6 text-[13px] leading-[1.6] text-ds-muted">
            Demo mode reads your files the same way, but nothing is saved.
          </p>
        ) : null}
      </div>
    );
  }

  if (screen === "parsing") {
    return (
      <div className="mx-auto max-w-[680px] py-16 text-center" role="status">
        <p className="font-display text-[24px] font-semibold leading-[1.2] text-ds-ink">{parseStatus}</p>
        <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted">
          {parseSeconds > 0 ? `Still reading… ${parseSeconds}s` : "Still reading…"}
        </p>
        <p className="mt-4 text-[16px] leading-[1.6] text-ds-muted">
          No coaching questions yet — we only extract what the assignment says.
        </p>
      </div>
    );
  }

  if (screen === "followup" && requirements) {
    return (
      <div className="mx-auto max-w-[680px]">
        <p className={dsEyebrow}>
          One quick check
        </p>
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
      <PauPauConfirm
        paperId={paperId}
        requirements={requirements}
        onChange={setRequirements}
        onConfirm={() => void confirmCard()}
        onEditDetails={() => {
          setError(null);
          setEditingDetails(true);
        }}
        onStartOver={() => setScreen("upload")}
        confirming={confirming}
        error={error}
      />
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

  if (screen === "coaching" && requirements) {
    const stanceMode = qIndex < 0;
    const q = stanceMode
      ? {
          id: "stance_early",
          kind: "coaching" as const,
          text: `${earlyStanceQuestion({
            topic: requirements.topic.value,
            promptQuestion: requirements.promptQuestion.value,
          })} ${EARLY_STANCE_MIN_NOTE}`,
        }
      : coachingPlan[qIndex];
    const isInterest = q?.kind === "interest";

    return (
      <div className="mx-auto max-w-[680px]">
        <p className={dsEyebrow}>
          {stanceMode
            ? "Your early stance"
            : isInterest
              ? "Get to know you"
              : "Assignment coaching"}
        </p>
        <h1 className={cn(dsH1, "mt-2")}>
          {q?.text ?? "Loading…"}
        </h1>
        {isInterest ? (
          <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted">
            Optional. We use this only to steer research leads toward things you
            find engaging.
          </p>
        ) : null}
        <div className="mt-6 space-y-4">
          {q?.kind === "background" ? (
            <div className="flex flex-wrap gap-2">
              {["Not comfortable yet", "Somewhat comfortable", "Comfortable"].map((choice) => (
                <DsButton
                  key={choice}
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-pressed={draftAnswer === choice}
                  className={
                    draftAnswer === choice
                      ? "border-ds-accent bg-[rgba(196,120,90,0.1)]"
                      : undefined
                  }
                  onClick={() => setDraftAnswer(choice)}
                >
                  {choice}
                </DsButton>
              ))}
            </div>
          ) : null}
          <Textarea
            className={dsTextarea}
            rows={q?.kind === "background" ? 3 : 8}
            value={draftAnswer}
            readOnly={restoringDraft && !draftAnswer}
            aria-busy={restoringDraft || undefined}
            onPaste={pasteMeta.onPaste}
            onDrop={pasteMeta.onDrop}
            onBeforeInput={pasteMeta.onBeforeInput}
            onChange={(e) => {
              pasteMeta.onChange(draftAnswer, e.target.value);
              setDraftAnswer(e.target.value);
            }}
            placeholder={
              restoringDraft && !draftAnswer
                ? "Restoring your draft…"
                : q?.kind === "background"
                  ? "A short answer is fine."
                  : "Write in your own words — paste is fine too."
            }
          />
          <p className="text-[13px] leading-[1.6] text-ds-muted">
            {restoringDraft && !draftAnswer ? (
              <span role="status">Restoring your draft… </span>
            ) : null}
            {wordCount(draftAnswer)} words
            {q?.kind && q.kind !== "background"
              ? " · counts toward your voice sample after you continue"
              : ""}{" "}
            <SaveStatus status={draftStatus} />
          </p>
        </div>

        {leads.length > 0 && q?.id !== "stance_early" ? (
          <div className="mt-8 space-y-4 border-t border-ds-border pt-8">
            <h2 className="font-display text-[20px] font-semibold leading-[1.2] text-ds-ink">Leads to verify</h2>
            <p className="text-[13px] leading-[1.6] text-ds-muted">
              These are starting points for Stage 4 — not citations.
            </p>
            {leads.map((lead) => (
              <div
                key={lead.name}
                className="rounded-[12px] border border-ds-border bg-ds-surface p-6 text-[16px] leading-[1.6] shadow-ds-card"
              >
                <p className="font-semibold text-ds-ink">{lead.name}</p>
                <p className="mt-2 text-ds-muted">{lead.whyAssignment}</p>
                {lead.whyInterest ? (
                  <p className="mt-2 text-ds-muted">{lead.whyInterest}</p>
                ) : null}
                {lead.hookOrExampleNote ? (
                  <p className="mt-2 text-[13px] leading-[1.6] text-ds-muted">
                    {lead.hookOrExampleNote}
                  </p>
                ) : null}
                <span className="mt-2 inline-block text-[13px] font-semibold uppercase tracking-wider text-ds-muted">
                  To verify
                </span>
                <div className="mt-4">
                  <DsButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => acceptLead(lead)}
                  >
                    Add as a lead
                  </DsButton>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 text-[16px] leading-[1.6] text-ds-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-4">
          {!stanceMode && qIndex > 0 ? (
            <DsButton type="button" variant="ghost" onClick={() => openQuestion(qIndex - 1)}>
              Previous question
            </DsButton>
          ) : null}
          {isInterest ? (
            <DsButton type="button" variant="ghost" onClick={skipInterest}>
              Skip get-to-know-you
            </DsButton>
          ) : null}
          {!stanceMode && q?.kind !== "background" ? (
            <DsButton
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => submitAnswer({ skip: true })}
            >
              Skip this one
            </DsButton>
          ) : null}
          <DsButton
            type="button"
            variant="primary"
            disabled={submitting}
            onClick={() => {
              if (submitting) return;
              setSubmitting(true);
              void (stanceMode ? submitStanceAnswer() : submitAnswer()).finally(() =>
                setSubmitting(false),
              );
            }}
          >
            {submitting ? "Saving…" : "Continue"}
          </DsButton>
        </div>
        <p className="mt-4 text-[13px] leading-[1.6] text-ds-muted">
          Voice sample: {voiceEval.totalWords} / {STAGE1_VOICE_MIN_WORDS} words <SaveStatus status={draftStatus} />
        </p>
      </div>
    );
  }

  if (screen === "story" && requirements) {
    return (
      <div className="mx-auto max-w-[680px]">
        <p className={dsEyebrow}>
          Pick your story
        </p>
        <h1 className={cn(dsH1, "mt-2")}>
          Pick your story
        </h1>
        <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted">
          Here are a few directions your paper could take, built from what you
          told me. Pick one, or write your own. You can change it later.
        </p>
        <div className="mt-6 space-y-4">
          {storyAngles.map((angle) => (
            <div
              key={angle.id}
              className={cn(
                "rounded-[12px] border bg-ds-surface p-6 shadow-ds-card transition-colors duration-150",
                pickingStory === angle.id ? "border-ds-accent" : "border-ds-border",
              )}
            >
              <p className="text-[16px] font-semibold leading-[1.6] text-ds-ink">{angle.question}</p>
              <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted">{angle.whyFits}</p>
              <DsButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={Boolean(pickingStory)}
                aria-busy={pickingStory === angle.id}
                className={cn(
                  "mt-4",
                  pickingStory === angle.id && "border-ds-accent bg-[rgba(196,120,90,0.1)] disabled:opacity-100",
                )}
                onClick={() => void pickStory(angle)}
              >
                {pickingStory === angle.id ? "Saving your pick…" : "Pick this one"}
              </DsButton>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <DsButton
            type="button"
            variant="ghost"
            onClick={() => setWritingOwnStory((v) => !v)}
          >
            I&apos;ll write my own
          </DsButton>
          {writingOwnStory ? (
            <div className="mt-4 space-y-4">
              <Textarea
                className={dsTextarea}
                rows={5}
                value={ownStory}
                onPaste={pasteMeta.onPaste}
                onDrop={pasteMeta.onDrop}
                onChange={(e) => {
                  pasteMeta.onChange(ownStory, e.target.value);
                  setOwnStory(e.target.value);
                }}
                placeholder="Write your own story angle as a question (≥ 15 words)."
              />
              <DsButton
                type="button"
                variant="primary"
                disabled={Boolean(pickingStory)}
                aria-busy={pickingStory === "own"}
                onClick={() => void submitOwnStory()}
              >
                {pickingStory === "own" ? "Saving your angle…" : "Use my angle"}
              </DsButton>
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="mt-4 text-[16px] leading-[1.6] text-ds-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (screen === "gate") {
    const sample = answers
      .filter((a) => a.isVoiceSample)
      .map((a) => a.answerText)
      .join("\n");
    const metrics = sample ? computeStyleMetrics(sample) : null;
    // The student sees words against the 200-word target, so that is what the
    // check mark and the "short side" note follow.
    const voiceWordsMet = voiceEval.totalWords >= STAGE1_VOICE_MIN_WORDS;

    return (
      <div className="mx-auto max-w-[680px]">
        <h1 className={dsH1}>Ready for stance?</h1>
        <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted">
          Stage 1 finishes when the assignment card is confirmed, you have
          picked a story, and you have an early take.
        </p>

        {metrics && voiceWordsMet && readyVoiceLine(voiceEval.totalWords) ? (
          <div className="mt-6 rounded-[8px] border border-ds-border border-l-4 border-l-ds-sage bg-ds-surface px-6 py-4 text-[16px] leading-[1.6] text-ds-ink">
            <p>{readyVoiceLine(voiceEval.totalWords)}</p>
          </div>
        ) : null}

        <ul className="mt-6 space-y-2 rounded-[12px] border border-ds-border bg-ds-surface p-6 text-[16px] leading-[1.6] text-ds-ink shadow-ds-card">
          <li>{cardGate.ok ? "✓" : "○"} Assignment checklist confirmed</li>
          <li>{storyAngle ? "✓" : "○"} Story angle picked</li>
          <li>
            {voiceWordsMet ? "✓" : "·"} Voice sample (
            {voiceEval.totalWords}/{STAGE1_VOICE_MIN_WORDS} words
            {voiceWordsMet ? "" : ", optional: more helps the coach match your voice"})
          </li>
          <li>{stanceOk ? "✓" : "○"} Early stance (≥ 25 words)</li>
        </ul>

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
              // Reopen the first voice answer, prefilled, so the student can extend it.
              const first = coachingPlan.findIndex(
                (question) => question.kind !== "background" && question.kind !== "interest",
              );
              openQuestion(first >= 0 ? first : 0);
            }}
          >
            Back to questions
          </DsButton>
          <DsButton
            type="button"
            variant="primary"
            disabled={
              startingStance ||
              stanceStartBlockers({
              checklistConfirmed: cardGate.ok,
              hasStory: Boolean(storyAngle),
              voiceOk: voiceEval.ok,
              voiceReason: voiceEval.reasons[0],
              stanceOk,
            }).length > 0}
            onClick={() => void completeStage1()}
          >
            {startingStance ? "Starting the stance interview…" : "Start stance interview"}
          </DsButton>
        </div>
        {stanceStartBlockers({
          checklistConfirmed: cardGate.ok,
          hasStory: Boolean(storyAngle),
          voiceOk: voiceEval.ok,
          voiceReason: voiceEval.reasons[0],
          stanceOk,
        }).map((reason) => (
          <p key={reason} className="mt-4 text-[16px] leading-[1.6] text-ds-muted" role="status">
            {reason}
          </p>
        ))}
        {voiceShortNote({ voiceOk: voiceWordsMet }) ? (
          <p className="mt-4 text-[16px] leading-[1.6] text-ds-muted" role="note">
            {voiceShortNote({ voiceOk: voiceWordsMet })}
          </p>
        ) : null}
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
