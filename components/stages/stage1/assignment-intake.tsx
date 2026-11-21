"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  UploadPanel,
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
import { extractTextFromFile } from "@/lib/assignment/local-extract";
import { canStartAssignmentParse } from "@/lib/assignment/can-start-parse";
import { missingImportant } from "@/lib/assignment/missing-important";
import { formatLengthLabel } from "@/lib/assignment/pages-to-words";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";
import { UNREADABLE_ASSIGNMENT } from "@/lib/papers/account";
import { parseLinkField } from "@/lib/assignment/provided-sources";
import {
  emptyRequirements,
  type AssignmentRequirements,
  type CitationStyle,
  type Field,
} from "@/lib/assignment/schema";
import {
  STAGE1_VOICE_MIN_WORDS,
} from "@/lib/config";
import {
  getDemoPaper,
  upsertDemoPaper,
  type DemoPaper,
} from "@/lib/demo/store";
import { extractInterestTags } from "@/lib/stage1/interest-tags";
import { createLead, type ResearchLeadDraft } from "@/lib/stage1/leads";
import { buildStoryAngleFallback } from "@/lib/stage1/story-angles";
import {
  evaluateStage1VoiceMinimum,
  type VoiceAnswer,
} from "@/lib/stage1/voice";
import { usePasteMeta } from "@/lib/hooks/use-paste-meta";
import { persistField } from "@/lib/papers/persist";
import { useDraftSave } from "@/lib/papers/use-draft-save";
import { SaveStatus } from "@/components/stages/save-status";
import { answersAfterSkippingInterest, resumeIntake, stanceStartBlockers } from "@/lib/stage1/intake-resume";
import { computeStyleMetrics } from "@/lib/style/metrics";
import { wordCount } from "@/lib/utils";

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
  const pasteMeta = usePasteMeta();
  const [paper, setPaper] = useState<DemoPaper | null>(null);
  const [screen, setScreen] = useState<Screen>("upload");
  const [paste, setPaste] = useState("");
  const [links, setLinks] = useState("");
  const [rightsOk, setRightsOk] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedAssignmentFile[]>([]);
  const [parseStatus, setParseStatus] = useState("Extracting the text…");
  const [requirements, setRequirements] =
    useState<AssignmentRequirements | null>(null);
  const [rawText, setRawText] = useState("");
  const [answers, setAnswers] = useState<IntakeAnswer[]>([]);
  const [leads, setLeads] = useState<ResearchLeadDraft[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [skippedInterest, setSkippedInterest] = useState(false);
  const [needFallback, setNeedFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPolicyAck, setAiPolicyAck] = useState(false);
  const [followupAsked, setFollowupAsked] = useState(false);
  const [checklistConfirmed, setChecklistConfirmed] = useState(false);
  const [storyAngles, setStoryAngles] = useState<StoryAngle[]>([]);
  const [storyAngle, setStoryAngle] = useState<{
    text: string;
    source: "ai" | "student";
  } | null>(null);
  const [ownStory, setOwnStory] = useState("");
  const [writingOwnStory, setWritingOwnStory] = useState(false);
  const [viewSource, setViewSource] = useState<{
    label: string;
    excerpt: string;
  } | null>(null);

  useEffect(() => {
    setPaper(accountPaper ?? getDemoPaper(paperId) ?? null);
    if (initialRequirements) {
      setRequirements(initialRequirements);
      setRawText(initialRawText);
      if (initialRequirements.topic.confirmed || initialRequirements.promptQuestion.confirmed) {
        setChecklistConfirmed(true);
      }
      setScreen((current) => (current === "upload" ? "card" : current));
    }
  }, [paperId, accountPaper, initialRequirements, initialRawText]);

  useEffect(() => {
    resumedIntake.current = false;
    if (demoMode) return;
    let cancelled = false;
    void fetch(`/api/papers/${paperId}/intake/answers`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: {
        answers?: IntakeAnswer[];
        storyAngle?: { text: string; source: "ai" | "student" } | null;
        resume?: { screen?: string | null; questionId?: string | null } | null;
      } | null) => {
        if (cancelled || !data) return;
        if (data.answers?.length) setAnswers(data.answers);
        if (data.storyAngle?.text) setStoryAngle(data.storyAngle);
        if (data.resume?.screen === "gate" || data.resume?.questionId === "stance_early") {
          setChecklistConfirmed(true);
          setScreen("gate");
          resumedIntake.current = true;
        }
      })
      .catch(() => undefined);
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
      text: `In your own words, what is ${topic} asking you to figure out?`,
    });
    plan.push({
      id: "personal_1",
      kind: "personal",
      text: `When have you seen an idea like ${topic} show up in real life — school, work, family, or something you follow? Write at least a few sentences.`,
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
    if (demoMode || resumedIntake.current || (answers.length === 0 && !storyAngle) || coachingPlan.length === 0) return;
    resumedIntake.current = true;
    const resume = resumeIntake(
      coachingPlan.map((question) => question.id),
      answers.map((answer) => answer.questionId),
    );
    if (resume.skipInterest) setSkippedInterest(true);
    if (resume.screen === "gate") {
      setScreen("gate");
      return;
    }
    if (resume.screen === "coaching") {
      const asked = new URLSearchParams(window.location.search).get("question");
      const askedIndex = asked ? coachingPlan.findIndex((question) => question.id === asked) : -1;
      setQIndex(askedIndex >= 0 ? askedIndex : resume.index);
      setScreen("coaching");
    }
  }, [demoMode, answers, coachingPlan, storyAngle]);

  const draftStatus = useDraftSave({
    paperId,
    fieldKey: `stage1:${coachingPlan[qIndex]?.id ?? "draft"}`,
    text: draftAnswer,
    enabled: !demoMode && screen === "coaching",
  });

  const voiceEval = useMemo(() => {
    const voiceAnswers: VoiceAnswer[] = answers
      .filter((a) => a.isVoiceSample)
      .map((a) => ({
        text: a.answerText,
        isVoiceSample: true,
        kind: a.kind,
        pasteRatio: a.pasteRatio,
      }));
    if (
      storyAngle?.source === "student" &&
      storyAngle.text.trim() &&
      !voiceAnswers.some((answer) => answer.text === storyAngle.text)
    ) {
      voiceAnswers.push({ text: storyAngle.text, isVoiceSample: true, kind: "story_angle" });
    }
    return evaluateStage1VoiceMinimum({ answers: voiceAnswers });
  }, [answers, storyAngle]);

  const earlyStance = answers.find((a) => a.questionId === "stance_early");
  const stanceOk = earlyStance ? wordCount(earlyStance.answerText) >= 25 : false;
  const cardGate = { ok: checklistConfirmed };

  if (!paper) {
    return <p className="text-rw-ink/55">Loading paper…</p>;
  }

  function openChecklist(next: AssignmentRequirements, corpus: string) {
    setRawText(corpus);
    setRequirements(next);
    const noPrompt = !next.topic.value?.trim() && !next.promptQuestion.value?.trim();
    if (!followupAsked && missingImportant(next) && !noPrompt) {
      setScreen("followup");
      return;
    }
    setScreen("card");
  }

  async function retryFile(id: string) {
    const target = stagedFiles.find((f) => f.id === id);
    if (!target) return;
    setError(null);
    const extracted = await extractTextFromFile(target.file);
    setStagedFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              extractedText: extracted.text,
              extractNote: extracted.note,
              method: extracted.method,
              pending: extracted.pending,
              failed: extracted.method === "unsupported" || (!extracted.text && !extracted.pending),
            }
          : f,
      ),
    );
    if (!extracted.text && extracted.pending) {
      setError(
        `We couldn't read ${target.filename} yet. Try again, or retake the photo in brighter light.`,
      );
    }
  }

  async function runParse() {
    setError(null);
    const linkList = parseLinkField(links);
    if (!rightsOk) {
      setError("Confirm you're uploading this for your own coursework.");
      return;
    }
    const hasFiles = stagedFiles.length > 0;
    const fileTexts = stagedFiles
      .map((f) => f.extractedText.trim())
      .filter(Boolean);
    // Paste / links are optional. Files alone are enough to continue.
    if (!hasFiles && !paste.trim() && linkList.length === 0) {
      setError("Upload a file, add optional text, or add at least one link.");
      return;
    }

    setScreen("parsing");
    setParseStatus(
      stagedFiles.some((f) => f.method === "ocr_pending" || f.pending)
        ? "Reading your photos…"
        : "Extracting the text…",
    );
    await new Promise((r) => setTimeout(r, 700));
    setParseStatus("Looking for length, citation style, and sources…");
    await new Promise((r) => setTimeout(r, 700));
    setParseStatus("Pulling out the rubric and structure…");
    await new Promise((r) => setTimeout(r, 500));

    try {
      await fetch(`/api/papers/${paperId}/assignment/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pasteText: paste.trim() || undefined,
          links: linkList.length ? linkList : undefined,
          extractedText: fileTexts.join("\n\n") || undefined,
          extractionMethod: fileTexts.length
            ? "txt"
            : paste.trim()
              ? "paste"
              : "manual",
        }),
      });
    } catch {
      /* parse continues */
    }

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
        if (data.needsConfirmation) {
          setError(data.message ?? UNREADABLE_ASSIGNMENT);
          openChecklist(data.requirements ?? emptyRequirements(), data.rawText ?? combined);
          return;
        }
        if (data.requirements) {
          if (data.error || data.saved === false) {
            setError(data.error ?? "We read the assignment but couldn't store it. Please try again.");
          }
          openChecklist(data.requirements, data.rawText ?? combined);
          return;
        }
        if (!demoMode) {
          setError(data.error ?? UNREADABLE_ASSIGNMENT);
          openChecklist(emptyRequirements(), combined);
          return;
        }
      } catch {
        if (!demoMode) {
          setError(UNREADABLE_ASSIGNMENT);
          openChecklist(emptyRequirements(), combined);
          return;
        }
      }
      openChecklist(
        parseAssignmentFallback(combined, {
          allowTopicAndDueDateGuess: process.env.NODE_ENV !== "production",
        }),
        combined,
      );
      return;
    }

    // Photos/PDF uploaded but no local text yet — still open the checklist.
    // Per-file Retry stays on the upload screen if they go back.
    openChecklist(emptyRequirements(), "");
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
    if (!requirements) return;
    const gate = assertAssignmentConfirmGate(requirements);
    if (!gate.ok) {
      setError(gate.reasons[0] ?? "Fix the citation style description first.");
      window.setTimeout(() => {
        document.getElementById("confirm-error")?.scrollIntoView({ block: "center" });
      }, 0);
      return;
    }
    const confirmed = gate.requirements;
    setRequirements(confirmed);
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
          return;
        }
      }
    } catch {
      if (!demoMode) {
        setError("We couldn't save this assignment. Please try again.");
        return;
      }
    }

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
    setQIndex(0);
    setDraftAnswer("");
  }

  function finishCoaching(nextAnswers: IntakeAnswer[]) {
    const phrases = nextAnswers
      .filter((a) => a.isVoiceSample && a.answerText.trim())
      .map((a) => a.answerText.trim().slice(0, 80));
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
    if (!q) return;
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

    const nextAnswers = [
      ...answers.filter((a) => a.questionId !== q.id),
      ...(opts?.skip
        ? []
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
      setQIndex(qIndex + 1);
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
    finishCoaching(nextAnswers);
  }

  function goToStanceOnStory() {
    setDraftAnswer("");
    setError(null);
    pasteMeta.reset();
    setScreen("coaching");
    // Stance is appended temporarily via a high qIndex sentinel handled below
    setQIndex(-1); // signals stance-only mode
  }

  async function pickStory(angle: StoryAngle) {
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
    goToStanceOnStory();
  }

  async function submitOwnStory() {
    const text = ownStory.trim();
    if (wordCount(text) < 15) {
      setError("Write at least 15 words for your own angle.");
      return;
    }
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
    const angleText = storyAngle?.text || "this assignment";
    const nextAnswers: IntakeAnswer[] = [
      ...answers.filter((a) => a.questionId !== "stance_early"),
      {
        questionId: "stance_early",
        questionText: `What's your early take on: ${angleText}`,
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
    if (!requirements || !paper) return;
    if (!cardGate.ok) {
      setError("Confirm the assignment card first.");
      return;
    }
    if (!voiceEval.ok) {
      setError(voiceEval.reasons[0] ?? "Voice sample is still short.");
      setScreen("coaching");
      return;
    }
    if (!stanceOk) {
      setError("Save an early stance of at least 25 words.");
      return;
    }

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

    return (
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
          Stage 1 · Intake
        </p>
        <h1 className="mt-2 font-display text-3xl text-rw-ink">
          Start with the assignment
        </h1>
        <p className="mt-3 text-sm text-rw-ink/65">
          Upload the full prompt — files, photos from your library, or a camera
          shot of the handout. We&apos;ll pull out the requirements, and
          you&apos;ll check them before we ask any questions.
        </p>

        <div className="mt-8 space-y-5">
          <UploadPanel
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
          <Button
            type="button"
            variant="secondary"
            disabled={!canSubmit}
            onClick={() => void runParse()}
          >
            Read my assignment
          </Button>
        </div>
        {demoMode ? (
          <p className="mt-6 text-xs text-rw-ink/45">
            Demo mode reads text files locally and uses a rule-based parser when
            Grok / OCR are offline.
          </p>
        ) : null}
      </div>
    );
  }

  if (screen === "parsing") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="font-display text-2xl text-rw-ink">{parseStatus}</p>
        <p className="mt-3 text-sm text-rw-ink/55">
          No coaching questions yet — we only extract what the assignment says.
        </p>
      </div>
    );
  }

  if (screen === "followup" && requirements) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
          One quick check
        </p>
        <h1 className="mt-2 font-display text-3xl text-rw-ink">
          Anything else for the assignment?
        </h1>
        <p className="mt-3 text-sm text-rw-ink/65">
          Is there any other context or page you want to add so I fully understand
          the assignment?
        </p>
        {error ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFollowupAsked(true);
              setScreen("upload");
            }}
          >
            Add files or text
          </Button>
          <Button
            type="button"
            variant="secondary"
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
          </Button>
        </div>
      </div>
    );
  }

  if (screen === "card" && requirements) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl text-rw-ink">Does this look right?</h1>
        <p className="mt-2 text-sm text-rw-ink/65">
          We read your prompt. Check every field. Fix anything that&apos;s off
          before we continue — we won&apos;t guess for you.
        </p>
        {error ? (
          <p id="confirm-error" className="mt-4 text-sm text-red-700" role="alert">
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
            label="Topic / prompt question"
            attention={
              fieldNeedsAttention(requirements.topic) ||
              fieldNeedsAttention(requirements.promptQuestion)
            }
            confirmed={
              requirements.topic.confirmed && requirements.promptQuestion.confirmed
            }
          >
            <Label className="text-xs text-rw-ink/50">Topic</Label>
            <Input
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
            <Label className="mt-3 text-xs text-rw-ink/50">Prompt question</Label>
            <Textarea
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
            <p className="text-sm text-rw-ink/70">
              {formatLengthLabel(requirements.length.value)}
            </p>
            <Input
              className="mt-2"
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
              className="flex h-11 w-full rounded-md border border-rw-ink/15 bg-white/80 px-3 text-sm"
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
                className="mt-2"
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
              <Input
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
              <Textarea
                rows={2}
                value={(requirements[key].value ?? []).join("\n")}
                onChange={(e) =>
                  updateField(
                    key,
                    markFieldConfirmed(requirements[key], {
                      value: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
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
              rows={2}
              value={
                requirements.requiredSources.value?.types ||
                requirements.requiredSources.value?.notes ||
                ""
              }
              onChange={(e) =>
                updateField(
                  "requiredSources",
                  markFieldConfirmed(requirements.requiredSources, {
                    value: {
                      ...(requirements.requiredSources.value ?? {}),
                      types: e.target.value,
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
            <Textarea
              rows={2}
              value={(requirements.providedReadings.value ?? [])
                .map((r) => r.title || r.url || "")
                .filter(Boolean)
                .join("\n")}
              onChange={(e) =>
                updateField(
                  "providedReadings",
                  markFieldConfirmed(requirements.providedReadings, {
                    value: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((title) => ({ title })),
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
            <Textarea
              rows={2}
              value={(requirements.rubricCriteria.value ?? [])
                .map((c) => c.name)
                .join("\n")}
              onChange={(e) =>
                updateField(
                  "rubricCriteria",
                  markFieldConfirmed(requirements.rubricCriteria, {
                    value: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((name) => ({ name })),
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
              className="flex h-11 w-full rounded-md border border-rw-ink/15 bg-white/80 px-3 text-sm"
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
              onLooksRight={() =>
                updateField("aiPolicy", markFieldConfirmed(requirements.aiPolicy))
              }
            />
          </CardField>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => setScreen("upload")}>
            Back
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void confirmCard()}
          >
            Looks right — continue
          </Button>
        </div>

        {viewSource ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-rw-ink/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="View source"
          >
            <div className="max-h-[70vh] w-full max-w-lg overflow-auto rounded-xl bg-rw-paper p-5 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
                View source · {viewSource.label}
              </p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-rw-ink/80">
                {viewSource.excerpt}
              </pre>
              <Button
                type="button"
                className="mt-4"
                variant="outline"
                onClick={() => setViewSource(null)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (screen === "ai_policy" && requirements) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
          Teacher AI policy
        </p>
        <h1 className="mt-2 font-display text-3xl text-rw-ink">
          Check before you continue
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-rw-ink/75">
          {AI_POLICY_NOTICE}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setScreen("card");
              setError(null);
            }}
          >
            I&apos;ll check first
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void confirmCard({ aiPolicyAck: true })}
          >
            Continue anyway
          </Button>
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
          text: `What's your early take on: ${storyAngle?.text || requirements.topic.value || "this assignment"}? (at least 25 words)`,
        }
      : coachingPlan[qIndex];
    const isInterest = q?.kind === "interest";

    return (
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
          {stanceMode
            ? "Your early stance"
            : isInterest
              ? "Get to know you"
              : "Assignment coaching"}
        </p>
        <h1 className="mt-2 font-display text-3xl text-rw-ink">
          {q?.text ?? "Loading…"}
        </h1>
        {isInterest ? (
          <p className="mt-2 text-sm text-rw-ink/60">
            Optional. We use this only to steer research leads toward things you
            find engaging.
          </p>
        ) : null}
        <div className="mt-6 space-y-3">
          <Textarea
            rows={q?.kind === "background" ? 3 : 8}
            value={draftAnswer}
            onPaste={pasteMeta.onPaste}
            onDrop={pasteMeta.onDrop}
            onBeforeInput={pasteMeta.onBeforeInput}
            onChange={(e) => {
              pasteMeta.onChange(draftAnswer, e.target.value);
              setDraftAnswer(e.target.value);
            }}
            placeholder={
              q?.kind === "background"
                ? "A short answer is fine."
                : "Write in your own words — paste is fine too."
            }
          />
          <p className="text-xs text-rw-ink/45">
            {wordCount(draftAnswer)} words
            {q?.kind && q.kind !== "background"
              ? " · counts toward your voice sample after you continue"
              : ""}
          </p>
        </div>

        {leads.length > 0 && q?.id !== "stance_early" ? (
          <div className="mt-8 space-y-3 border-t border-rw-ink/10 pt-6">
            <h2 className="font-semibold text-rw-ink">Leads to verify</h2>
            <p className="text-xs text-rw-ink/55">
              These are starting points for Stage 4 — not citations.
            </p>
            {leads.map((lead) => (
              <div
                key={lead.name}
                className="border-b border-rw-ink/10 py-3 text-sm"
              >
                <p className="font-medium text-rw-ink">{lead.name}</p>
                <p className="mt-1 text-rw-ink/65">{lead.whyAssignment}</p>
                {lead.whyInterest ? (
                  <p className="mt-1 text-rw-ink/65">{lead.whyInterest}</p>
                ) : null}
                {lead.hookOrExampleNote ? (
                  <p className="mt-1 text-xs text-rw-ink/50">
                    {lead.hookOrExampleNote}
                  </p>
                ) : null}
                <span className="mt-2 inline-block text-xs font-semibold uppercase tracking-wide text-rw-teal">
                  To verify
                </span>
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => acceptLead(lead)}
                  >
                    Add as a lead
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {isInterest ? (
            <Button type="button" variant="ghost" onClick={skipInterest}>
              Skip get-to-know-you
            </Button>
          ) : null}
          {!stanceMode && q?.kind !== "background" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => submitAnswer({ skip: true })}
            >
              Skip this one
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void (stanceMode ? submitStanceAnswer() : submitAnswer())
            }
          >
            Continue
          </Button>
        </div>
        <p className="mt-4 text-xs text-rw-ink/45">
          Voice sample: {voiceEval.totalWords} / {STAGE1_VOICE_MIN_WORDS} words <SaveStatus status={draftStatus} />
        </p>
      </div>
    );
  }

  if (screen === "story" && requirements) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
          Pick your story
        </p>
        <h1 className="mt-2 font-display text-3xl text-rw-ink">
          Pick your story
        </h1>
        <p className="mt-2 text-sm text-rw-ink/65">
          Here are a few directions your paper could take, built from what you
          told me. Pick one, or write your own. You can change it later.
        </p>
        <div className="mt-6 space-y-4">
          {storyAngles.map((angle) => (
            <div
              key={angle.id}
              className="border-b border-rw-ink/10 py-4"
            >
              <p className="font-medium text-rw-ink">{angle.question}</p>
              <p className="mt-1 text-sm text-rw-ink/60">{angle.whyFits}</p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                variant="outline"
                onClick={() => void pickStory(angle)}
              >
                Pick this one
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setWritingOwnStory((v) => !v)}
          >
            I&apos;ll write my own
          </Button>
          {writingOwnStory ? (
            <div className="mt-3 space-y-3">
              <Textarea
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => void submitOwnStory()}
              >
                Use my angle
              </Button>
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
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

    return (
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl text-rw-ink">Ready for stance?</h1>
        <p className="mt-2 text-sm text-rw-ink/65">
          Stage 1 finishes when the assignment card is confirmed, your voice
          sample meets the minimum, and you have an early take.
        </p>

        {metrics ? (
          <div className="mt-6 border-y border-rw-ink/10 py-5 text-sm text-rw-ink/75">
            <p>We have enough of your voice to coach you.</p>
            {metrics.topContentWords.length > 0 ? (
              <p className="mt-2">
                A few words that sound like you:{" "}
                {metrics.topContentWords.map((w) => w.word).slice(0, 6).join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}

        <ul className="mt-6 space-y-2 text-sm">
          <li>{cardGate.ok ? "✓" : "○"} Assignment checklist confirmed</li>
          <li>{storyAngle ? "✓" : "○"} Story angle picked</li>
          <li>
            {voiceEval.ok ? "✓" : "○"} Voice minimum (
            {voiceEval.totalWords}/{STAGE1_VOICE_MIN_WORDS} words,{" "}
            {voiceEval.longAnswerCount} long answers)
          </li>
          <li>{stanceOk ? "✓" : "○"} Early stance (≥ 25 words)</li>
        </ul>

        {error ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => setScreen("coaching")}>
            Back to questions
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={stanceStartBlockers({
              checklistConfirmed: cardGate.ok,
              hasStory: Boolean(storyAngle),
              voiceOk: voiceEval.ok,
              voiceReason: voiceEval.reasons[0],
              stanceOk,
            }).length > 0}
            onClick={() => void completeStage1()}
          >
            Start stance interview
          </Button>
        </div>
        {stanceStartBlockers({
          checklistConfirmed: cardGate.ok,
          hasStory: Boolean(storyAngle),
          voiceOk: voiceEval.ok,
          voiceReason: voiceEval.reasons[0],
          stanceOk,
        }).map((reason) => (
          <p key={reason} className="mt-3 text-sm text-rw-ink/70" role="status">
            {reason}
          </p>
        ))}
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
      className={`rounded-md border px-4 py-4 ${
        attention && !confirmed
          ? "border-amber-500/50 bg-amber-50/40"
          : "border-rw-ink/10 bg-white/40"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-rw-ink">{label}</p>
        {confirmed ? (
          <span className="text-xs text-rw-teal">Confirmed</span>
        ) : attention ? (
          <span className="text-xs text-amber-700">Needs a look</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function FieldActions({
  onLooksRight,
  onNotSpecified,
  onViewSource,
}: {
  onLooksRight: () => void;
  onNotSpecified?: () => void;
  onViewSource?: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onLooksRight}>
        Looks right
      </Button>
      {onNotSpecified ? (
        <Button type="button" size="sm" variant="ghost" onClick={onNotSpecified}>
          Not specified
        </Button>
      ) : null}
      {onViewSource ? (
        <Button type="button" size="sm" variant="ghost" onClick={onViewSource}>
          View source
        </Button>
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
