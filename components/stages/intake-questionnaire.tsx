"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MIN_VOICE_SAMPLE_WORDS } from "@/lib/config";
import { isThinAnswer } from "@/lib/coaching/thin";
import {
  getDemoPaper,
  upsertDemoPaper,
  type DemoPaper,
} from "@/lib/demo/store";
import { computeStyleMetrics, type StyleMetrics } from "@/lib/style/metrics";
import { wordCount } from "@/lib/utils";

type StepId =
  | "course"
  | "prompt"
  | "due"
  | "length"
  | "citation"
  | "school"
  | "know"
  | "struggles"
  | "stance"
  | "voice";

type Step = {
  id: StepId;
  block: 1 | 2 | 3 | 4;
  title: string;
  prompt: string;
  kind: "text" | "textarea" | "date" | "select";
  minWords?: number;
  probe?: string;
  options?: string[];
  pasteBlocked?: boolean;
};

const STEPS: Step[] = [
  {
    id: "course",
    block: 1,
    title: "Assignment",
    prompt: "What course is this for?",
    kind: "text",
  },
  {
    id: "prompt",
    block: 1,
    title: "Assignment",
    prompt: "Paste the assignment prompt (at least 15 words).",
    kind: "textarea",
    minWords: 15,
  },
  {
    id: "due",
    block: 1,
    title: "Assignment",
    prompt: "When is it due?",
    kind: "date",
  },
  {
    id: "length",
    block: 1,
    title: "Assignment",
    prompt: "Required length (e.g. 1500 words or 5 pages).",
    kind: "text",
  },
  {
    id: "citation",
    block: 1,
    title: "Assignment",
    prompt: "Citation style?",
    kind: "select",
    options: ["APA", "MLA", "Chicago", "Harvard", "Other / not sure"],
  },
  {
    id: "school",
    block: 2,
    title: "Background",
    prompt: "What school level are you in?",
    kind: "select",
    options: ["High school", "Undergrad", "Grad", "Other"],
  },
  {
    id: "know",
    block: 2,
    title: "Background",
    prompt: "What do you already know about this topic?",
    kind: "textarea",
    minWords: 10,
  },
  {
    id: "struggles",
    block: 2,
    title: "Background",
    prompt: "What usually trips you up when writing papers?",
    kind: "textarea",
    minWords: 10,
  },
  {
    id: "stance",
    block: 3,
    title: "Topic stance",
    prompt: "What's your initial position, and why?",
    kind: "textarea",
    minWords: 25,
    probe: "What's one reason someone might disagree?",
  },
  {
    id: "voice",
    block: 4,
    title: "Your natural voice",
    prompt: `Write ~150–300 words, no editing, about anything you care about — the way you'd text a friend who asked. (Minimum ${MIN_VOICE_SAMPLE_WORDS} words.)`,
    kind: "textarea",
    minWords: MIN_VOICE_SAMPLE_WORDS,
    pasteBlocked: true,
  },
];

type Answers = Record<StepId, string>;

const EMPTY: Answers = {
  course: "",
  prompt: "",
  due: "",
  length: "",
  citation: "",
  school: "",
  know: "",
  struggles: "",
  stance: "",
  voice: "",
};

type Props = {
  paperId: string;
  demoMode?: boolean;
};

export function IntakeQuestionnaire({ paperId, demoMode = true }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [probeCount, setProbeCount] = useState(0);
  const [probeText, setProbeText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceReadout, setVoiceReadout] = useState<StyleMetrics | null>(null);

  const step = STEPS[stepIndex];
  const value = answers[step.id];
  const words = useMemo(() => wordCount(value), [value]);

  function update(next: string) {
    setAnswers((prev) => ({ ...prev, [step.id]: next }));
    setError(null);
  }

  function persistPartial(nextAnswers: Answers, metrics?: StyleMetrics) {
    if (!demoMode) return;
    const paper = getDemoPaper(paperId);
    if (!paper) return;
    const updated: DemoPaper = {
      ...paper,
      course: nextAnswers.course || null,
      assignment_prompt: nextAnswers.prompt || null,
      due_date: nextAnswers.due || null,
      required_length: nextAnswers.length || null,
      citation_style: nextAnswers.citation || null,
      title: nextAnswers.course
        ? `${nextAnswers.course} paper`
        : paper.title,
      stage_progress: paper.stage_progress.map((s) =>
        s.stage === 1
          ? {
              ...s,
              data: {
                ...s.data,
                answers: nextAnswers,
                school_level: nextAnswers.school,
                background: {
                  know: nextAnswers.know,
                  struggles: nextAnswers.struggles,
                },
                stance: nextAnswers.stance,
              },
            }
          : s,
      ),
    };
    if (metrics) {
      updated.style_profile = { ...metrics, raw_sample: nextAnswers.voice };
    }
    upsertDemoPaper(updated);
  }

  function completeStage(nextAnswers: Answers, metrics: StyleMetrics) {
    if (!demoMode) return;
    const paper = getDemoPaper(paperId);
    if (!paper) return;
    const updated: DemoPaper = {
      ...paper,
      course: nextAnswers.course,
      assignment_prompt: nextAnswers.prompt,
      due_date: nextAnswers.due,
      required_length: nextAnswers.length,
      citation_style: nextAnswers.citation,
      title: `${nextAnswers.course} paper`,
      current_stage: 2,
      style_profile: { ...metrics, raw_sample: nextAnswers.voice },
      stage_progress: paper.stage_progress.map((s) => {
        if (s.stage === 1) {
          return {
            ...s,
            status: "complete",
            data: {
              answers: nextAnswers,
              school_level: nextAnswers.school,
              completed_at: new Date().toISOString(),
            },
          };
        }
        if (s.stage === 2) return { ...s, status: "in_progress" };
        return s;
      }),
    };
    upsertDemoPaper(updated);
  }

  function onContinue() {
    const min = step.minWords ?? (step.kind === "textarea" ? 1 : 1);
    if (!value.trim()) {
      setError("Please answer before continuing.");
      return;
    }
    if (step.minWords) {
      const thin = isThinAnswer(value, step.minWords, step.prompt);
      if (thin.thin && probeCount < 2) {
        setProbeCount((c) => c + 1);
        setProbeText(
          step.probe ??
            "Can you say a bit more in your own words? A concrete detail helps.",
        );
        setError(null);
        return;
      }
    } else if (step.kind !== "select" && step.kind !== "date" && words < min) {
      setError("Please fill this in.");
      return;
    }

    const nextAnswers = { ...answers, [step.id]: value };
    persistPartial(nextAnswers);

    if (step.id === "voice") {
      // SOP: coaching only, never generate submission text
      const metrics = computeStyleMetrics(value);
      setVoiceReadout(metrics);
      completeStage(nextAnswers, metrics);
      return;
    }

    setProbeCount(0);
    setProbeText(null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function onStuck() {
    setProbeCount(0);
    setProbeText(null);
    if (stepIndex >= STEPS.length - 1) {
      const metrics = computeStyleMetrics(value);
      setVoiceReadout(metrics);
      completeStage({ ...answers, [step.id]: value }, metrics);
      return;
    }
    setStepIndex((i) => i + 1);
  }

  if (voiceReadout) {
    return (
      <div className="mx-auto max-w-xl animate-rise space-y-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
          Stage 1 complete
        </p>
        <h2 className="font-display text-3xl text-rw-ink">Your natural voice</h2>
        <p className="text-rw-ink/70">
          ~{Math.round(voiceReadout.avgSentenceLength)} words per sentence,
          grade-level {voiceReadout.readingGrade.toFixed(1)},{" "}
          {voiceReadout.formality} tone. Your go-to words:{" "}
          {voiceReadout.topContentWords
            .slice(0, 5)
            .map((w) => w.word)
            .join(", ") || "—"}.
        </p>
        <p className="text-sm text-rw-ink/55">
          These metrics are for coaching feedback only — never used to write
          your paper.
        </p>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => {
            window.location.assign(`/app/papers/${paperId}/stage/2`);
          }}
        >
          Continue to Stage 2
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
          Stage 1 · Block {step.block} of 4 · {step.title}
        </p>
        <p className="text-xs text-rw-ink/45">
          {stepIndex + 1}/{STEPS.length}
        </p>
      </div>
      <h2 className="mt-3 font-display text-3xl text-rw-ink">{step.prompt}</h2>
      {probeText && (
        <p className="mt-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {probeText}
        </p>
      )}

      <div className="mt-6 space-y-3">
        <Label htmlFor={step.id} className="sr-only">
          {step.prompt}
        </Label>
        {step.kind === "select" ? (
          <select
            id={step.id}
            className="flex h-11 w-full rounded-md border border-rw-ink/15 bg-white/80 px-3 text-sm"
            value={value}
            onChange={(e) => update(e.target.value)}
          >
            <option value="">Select…</option>
            {step.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : step.kind === "date" ? (
          <Input
            id={step.id}
            type="date"
            value={value}
            onChange={(e) => update(e.target.value)}
          />
        ) : step.kind === "textarea" ? (
          <Textarea
            id={step.id}
            rows={step.id === "voice" ? 12 : 6}
            value={value}
            onChange={(e) => update(e.target.value)}
            onPaste={
              step.pasteBlocked
                ? (e) => {
                    e.preventDefault();
                    setError(
                      "Paste is disabled here — we need your natural typing voice.",
                    );
                  }
                : undefined
            }
            onDrop={
              step.pasteBlocked
                ? (e) => {
                    e.preventDefault();
                  }
                : undefined
            }
          />
        ) : (
          <Input
            id={step.id}
            value={value}
            onChange={(e) => update(e.target.value)}
          />
        )}
        {typeof step.minWords === "number" && (
          <p className="text-xs text-rw-ink/45">
            {words} / {step.minWords} words
            {step.pasteBlocked ? " · paste disabled" : ""}
          </p>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button size="lg" variant="secondary" onClick={onContinue}>
          Continue
        </Button>
        {probeCount >= 2 && (
          <Button size="lg" variant="outline" onClick={onStuck}>
            I&apos;m stuck — flag for help
          </Button>
        )}
      </div>
    </div>
  );
}
