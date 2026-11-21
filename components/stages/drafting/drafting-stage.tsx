"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { connectorChips, type ConnectorRelation } from "@/lib/coaching/connectors";
import {
  FIRST_SUMMARY,
  INTRO_FOOTER,
  INTRO_FORMATS,
  OPENER,
  SHOT_SUMMARY,
  type IntroVariant,
} from "@/lib/coaching/introFormats";
import { CONCLUSION_PROMPTS, PARAGRAPH_SHAPES, ROUGH_INTRO_COPY, WRITE_FOR_ME_DECLINE } from "@/lib/coaching/paragraphShapes";
import { buildFramework, type FrameworkParagraph } from "@/lib/drafting/framework";
import { buildLedger, type LedgerInput } from "@/lib/drafting/ledger";
import { shapeReadback, type ReadbackFlag } from "@/lib/drafting/readback";
import { nextDraftScreen, type DraftScreen } from "@/lib/drafting/screen";
import { commitSentence } from "@/lib/drafting/sentences";
import { variantFromPromptType } from "@/lib/drafting/variants";
import { requestHiddenDraftMilestone } from "@/lib/drafting/requestMilestone";
import { persistField } from "@/lib/papers/persist";
import { useDraftSave } from "@/lib/papers/use-draft-save";
import { SaveStatus } from "@/components/stages/save-status";
import { buildSkeleton } from "@/lib/skeleton/build";
import { wordCount } from "@/lib/utils";

type Props = {
  paperId: string;
  promptType: "lesson" | "personal_experience" | "mixed";
  storyAngle: string;
  thesis: string;
  lessonConcept: string | null;
  sections: {
    key: string;
    title: string;
    kind: string;
    mode: "lesson" | "memory";
    ideas: string[];
    chosenLead: string | null;
    teachAspect: string | null;
  }[];
};

type Saved = Record<string, string[]>;

const ORDINALS = ["one", "two", "three", "four", "five", "six", "seven", "eight"];

function storageKey(paperId: string) {
  return `rw_draft_${paperId}`;
}

export function DraftingStage({
  paperId,
  promptType,
  storyAngle,
  thesis,
  lessonConcept,
  sections,
  persist = true,
}: Props & { persist?: boolean }) {
  const router = useRouter();
  const ledger = useMemo(
    () =>
      buildLedger({
        paperId,
        promptType,
        storyAngle,
        thesis,
        lessonConcept,
        sections,
      } satisfies LedgerInput),
    [paperId, promptType, storyAngle, thesis, lessonConcept, sections],
  );
  const plan = useMemo(() => buildFramework(ledger), [ledger]);
  const variant = variantFromPromptType(promptType, sections[0]?.mode);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<"opener" | "read" | "draft" | "tighten">("opener");
  const [choice, setChoice] = useState<"shot" | "breakdown" | null>(null);
  const [showShape, setShowShape] = useState(false);
  const [draft, setDraft] = useState("");
  const draftStatus = useDraftSave({
    paperId,
    fieldKey: `draft:${plan[index]?.key ?? "section"}:wip`,
    text: draft,
    enabled: persist,
  });
  const [saved, setSaved] = useState<Saved>({});
  const [screen, setScreen] = useState<DraftScreen>("zoomed_in");
  const [checked, setChecked] = useState(false);
  const [promptCursor, setPromptCursor] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jumpBack, setJumpBack] = useState<number | null>(null);
  const [decline, setDecline] = useState(false);
  const [serverFlags, setServerFlags] = useState<ReadbackFlag[]>([]);
  const [serverIdeas, setServerIdeas] = useState<{ id: string; text: string; sectionKey: string }[] | null>(null);
  const milestoneHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const raw = window.localStorage.getItem(storageKey(paperId));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        index?: number;
        step?: typeof step;
        choice?: typeof choice;
        saved?: Saved;
        screen?: DraftScreen;
      };
      if (parsed.index != null) setIndex(parsed.index);
      if (parsed.step) setStep(parsed.step);
      if (parsed.choice) setChoice(parsed.choice);
      if (parsed.saved) setSaved(parsed.saved);
      if (parsed.screen) setScreen(parsed.screen);
    } catch {
      /* resume at the opener */
    }
  }, [paperId]);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey(paperId),
      JSON.stringify({ index, step, choice, saved, screen, draftingMode: "muscle" }),
    );
    void fetch(`/api/papers/${paperId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentStage: 5,
        progress: [{ stage: 5, status: "in_progress" }],
        data: {
          draftingMode: "muscle",
          resumeBeat: { stage: 5, sectionKey: plan[index]?.key ?? "intro", step, paragraphKey: plan[index]?.key },
          screen,
        },
      }),
    });
  }, [paperId, index, step, choice, saved, screen, plan]);

  useEffect(() => {
    if (screen !== "review_all") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setScreen("milestone");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  useEffect(() => {
    if (screen === "milestone") milestoneHeading.current?.focus();
  }, [screen]);

  const current = plan[index];
  const sentences = current ? saved[current.key] ?? [] : [];
  const localIdeas = (current?.notes ?? []).map((text, ideaIndex) => ({
    id: `${current?.key ?? "p"}-${ideaIndex}`,
    text,
    sectionKey: current?.sectionKey ?? "",
  }));
  const noteKey = localIdeas.map((idea) => idea.text).join("|");
  const readback = shapeReadback({ ideas: localIdeas });
  const flags = serverFlags.length ? serverFlags : readback.flags;
  const shownIdeas = serverIdeas ?? readback.ideas;

  useEffect(() => {
    if (!current || localIdeas.length === 0) {
      setServerFlags([]);
      setServerIdeas(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/papers/${paperId}/draft/readback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ideas: localIdeas,
        labels: sections.map((section) => ({ key: section.key, title: section.title })),
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          ideas?: { id: string; text: string; sectionKey: string }[];
          flags?: ReadbackFlag[];
        };
        if (cancelled) return;
        if (data.ideas) setServerIdeas(data.ideas);
        if (data.flags) setServerFlags(data.flags.slice(0, 2));
      })
      .catch(() => {
        if (!cancelled) {
          setServerFlags([]);
          setServerIdeas(null);
        }
      });
    return () => {
      cancelled = true;
    };
    // noteKey is the stable content of localIdeas for this paragraph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, current?.key, noteKey]);
  const skeleton = buildSkeleton(
    plan.map((row) => ({
      key: row.key,
      title: row.title,
      notes: row.notes,
      sentences: saved[row.key] ?? [],
    })),
  );

  if (!current) return null;

  async function saveSentence() {
    if (!current || !draft.trim()) return;
    if (/write it for me|give me an example sentence/i.test(draft)) {
      setDecline(true);
      return;
    }
    const statuses = plan.map((row) => ({
      key: row.key,
      sectionKey: row.sectionKey,
      status: (saved[row.key]?.length ? "saved" : row.key === current.key ? "open" : "locked") as
        | "locked"
        | "open"
        | "saved",
    }));
    const res = await fetch(`/api/papers/${paperId}/draft/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paragraphs: statuses, targetKey: current.key, text: draft }),
    });
    if (res.status === 409) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Finish the earlier section first.");
      return;
    }
    const nextSentences = commitSentence(saved[current.key] ?? [], draft.trim());
    if (persist) {
      const savedOk = await persistField(paperId, {
        fieldKey: `draft:${current.key}`,
        text: nextSentences.join("\n"),
        submitted: true,
        resume: { stage: 5, sectionKey: current.key, screen: "draft" },
      });
      if (!savedOk) {
        setError("Couldn't save this sentence. It is still in the box.");
        return;
      }
    }
    setSaved((prev) => ({ ...prev, [current.key]: nextSentences }));
    setDraft("");
    setError(null);
    setDecline(false);
  }

  async function finishParagraph() {
    const words = wordCount((saved[current.key] ?? []).join(" "));
    if (words < current.minWords) {
      setError(`Write at least ${current.minWords} words in your own words before this part is done.`);
      return;
    }
    if (!checked) {
      setChecked(true);
      setStep("tighten");
      return;
    }
    const last = index >= plan.length - 1;
    if (persist) {
      const savedOk = await persistField(paperId, {
        fieldKey: `draft:${current.key}`,
        text: (saved[current.key] ?? []).join("\n"),
        submitted: true,
        resume: { stage: 5, sectionKey: current.key, screen: last ? "payoff" : "milestone" },
      });
      if (!savedOk) {
        setError("Couldn't save this section. It is still here.");
        return;
      }
    }
    setScreen(nextDraftScreen("zoomed_in", last ? "conclusion_saved" : "section_saved"));
    requestHiddenDraftMilestone(paperId, {
      trigger: "draft_section_done",
      draftingComplete: last,
      stage: 5,
      promptType,
      storyAngle,
      thesis,
      lessonConcept,
      sections: sections.map((section) => ({
        key: section.key,
        title: section.title,
        kind: section.kind,
        ideas: section.ideas,
      })),
    });
  }

  function openNext() {
    const next = Math.min(plan.length - 1, index + 1);
    setIndex(next);
    setStep("opener");
    setChoice(null);
    setShowShape(false);
    setChecked(false);
    setScreen(nextDraftScreen(screen, "ready_next"));
  }

  const shapeLine =
    current.kind === "conclusion"
      ? PARAGRAPH_SHAPES.conclusion.line
      : current.kind === "intro"
        ? SHOT_SUMMARY.intro
        : current.kind === "counter"
          ? PARAGRAPH_SHAPES.counter.line
          : PARAGRAPH_SHAPES.body.line;
  const relation: ConnectorRelation = current.kind === "conclusion" ? "looking_back" : "sequence";

  return (
    <div className={reduceMotion ? "" : "transition-opacity"}>
      <div aria-hidden="true" className="pointer-events-none mb-2 flex gap-2 overflow-hidden text-[10px] leading-none text-rw-ink/15">
        {skeleton.map((block) => (
          <span key={block.key} className="min-w-0 flex-1 truncate">
            {block.label}
          </span>
        ))}
      </div>
      <nav aria-label="Paper progress" className="mb-4">
        <p className="sr-only">
          Paragraph {index + 1} of {plan.length} in progress
        </p>
        <button
          type="button"
          className="flex h-2 w-full gap-1 opacity-40"
          onClick={() => setScreen(nextDraftScreen("zoomed_in", "ghost_tap"))}
        >
          {skeleton.map((block) => (
            <span
              key={block.key}
              className={`h-2 flex-1 rounded-full ${block.status === "drafted" ? "bg-rw-teal" : "bg-rw-ink/20"}`}
            />
          ))}
        </button>
      </nav>

      {screen === "zoomed_in" || screen === "jump_edit" ? (
        <section className="mx-auto max-w-xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">Drafting</p>
          <h1 className="font-display text-3xl text-rw-ink">{current.title}</h1>
          {jumpBack != null ? (
            <Button type="button" variant="outline" onClick={() => { setIndex(jumpBack); setJumpBack(null); setScreen("zoomed_in"); }}>
              Back to where you were
            </Button>
          ) : null}
          {step === "opener" ? (
            <div className="space-y-3">
              <p className="font-medium text-rw-ink">{OPENER}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => { setChoice("shot"); setShowShape(false); setStep("read"); }}>
                  I&apos;ll give it a shot
                </Button>
                <Button type="button" variant="outline" onClick={() => { setChoice("breakdown"); setShowShape(true); setStep("read"); }}>
                  Break it down for me
                </Button>
              </div>
            </div>
          ) : null}
          {step !== "opener" && (choice === "shot" || showShape) ? (
            <p className="text-sm text-rw-ink/70">{shapeLine}</p>
          ) : null}
          {step !== "opener" && !showShape ? (
            <Button type="button" variant="outline" onClick={() => setShowShape(true)}>
              Show me the shape
            </Button>
          ) : null}
          {showShape && current.kind === "intro" ? (
            <div className="rounded-xl bg-white p-4 text-sm">
              <p className="font-medium">Ways to open your paper</p>
              <ul className="mt-2 space-y-2">
                {INTRO_FORMATS[variant as IntroVariant].map((format) => (
                  <li key={format.id}>
                    <span className="font-medium">{format.label}.</span> {format.lines}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-rw-ink/70">{INTRO_FOOTER}</p>
            </div>
          ) : null}
          {showShape && (current.kind === "body" || current.kind === "counter") ? (
            <div className="rounded-xl bg-white p-4 text-sm">
              <p className="font-medium">
                {current.kind === "counter" ? PARAGRAPH_SHAPES.counter.title : PARAGRAPH_SHAPES.body.title}
              </p>
              <p className="mt-2">{current.kind === "counter" ? PARAGRAPH_SHAPES.counter.line : PARAGRAPH_SHAPES.body.line}</p>
            </div>
          ) : null}
          {showShape && current.kind === "conclusion" ? (
            <div className="rounded-xl bg-white p-4 text-sm">
              <p className="font-medium">{PARAGRAPH_SHAPES.conclusion.title}</p>
              <p className="mt-2">{PARAGRAPH_SHAPES.conclusion.card}</p>
              <p className="mt-3">{CONCLUSION_PROMPTS[promptCursor % CONCLUSION_PROMPTS.length]}</p>
              <Button type="button" className="mt-3" variant="outline" onClick={() => setPromptCursor((n) => n + 1)}>
                Another question
              </Button>
            </div>
          ) : null}
          {step !== "opener" ? (
            <div className="text-sm text-rw-ink/80">
              <p>Here are the ideas we captured, in your words.</p>
              {storyAngle ? <p className="mt-2">Your story: {storyAngle}</p> : null}
              {thesis ? <p>Your main point: {thesis}</p> : null}
              <ol className="mt-2 list-decimal pl-5">
                {shownIdeas.map((idea) => (
                  <li key={idea.id}>{idea.text}</li>
                ))}
              </ol>
              {flags.map((flag) => (
                <p key={flag.ideaId} className="mt-2">{flag.text}</p>
              ))}
              {current.kind === "intro" ? <p className="mt-3 font-medium">{FIRST_SUMMARY[variant]}</p> : null}
            </div>
          ) : null}
          {step === "read" || step === "draft" || step === "tighten" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                {sentences.map((sentence, sentenceIndex) => (
                  <p key={`${sentence}-${sentenceIndex}`} className="rounded-md bg-white px-3 py-2 text-sm">
                    {sentence}
                  </p>
                ))}
              </div>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Start here. It doesn't need to be perfect."
              />
              <SaveStatus status={draftStatus} />
              <p className="text-xs text-rw-ink/50">{wordCount([...sentences, draft].join(" "))} words</p>
              {sentences.length > 0 ? (
                <div>
                  <p className="text-xs text-rw-ink/60">Words that can help connect this:</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {connectorChips(relation).map((chip) => (
                      <span key={chip} className="rounded-full border border-rw-ink/15 px-2 py-1 text-xs">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void saveSentence()} disabled={!draft.trim()}>
                  Add sentence
                </Button>
                <Button type="button" variant="outline" onClick={() => void finishParagraph()}>
                  {current.kind === "intro" ? "Check my intro" : "This paragraph is done"}
                </Button>
              </div>
              {checked ? <p className="text-sm text-rw-teal">{current.kind === "intro" ? ROUGH_INTRO_COPY : "Saved as your words. Tighten only if you want to."}</p> : null}
              {decline ? <p className="text-sm">{WRITE_FOR_ME_DECLINE}</p> : null}
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {screen === "milestone" ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-rw-ink/40 p-4" role="dialog" aria-modal="true" aria-label={`${current.title} is done`}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-8 space-y-3 text-sm text-white/25">
            {skeleton.map((block) => (
              <p key={block.key}>{block.label}</p>
            ))}
          </div>
          <div className="relative max-w-md rounded-xl bg-white p-5">
            <h2 ref={milestoneHeading} tabIndex={-1} className="font-display text-2xl outline-none">
              {current.title} is done.
            </h2>
            <p className="sr-only">{current.title} is done. Here is your paper so far.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={openNext}>
                {plan[index + 1]?.kind === "conclusion"
                  ? "Ready for your conclusion?"
                  : `Ready for section ${ORDINALS[index + 1] ?? index + 2}?`}
              </Button>
              <Button type="button" variant="outline" onClick={() => setScreen("review_all")}>
                Do you want to review?
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {screen === "review_all" ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Review all</h2>
          {plan.map((row, rowIndex) => {
            const drafted = (saved[row.key] ?? []).length > 0;
            return (
              <article key={row.key} className="rounded-xl bg-white p-4 text-sm">
                <h3 className="font-medium">{row.title}</h3>
                {drafted ? (
                  <button
                    type="button"
                    className="mt-2 text-left text-rw-teal"
                    onClick={() => {
                      setJumpBack(index);
                      setIndex(rowIndex);
                      setScreen("jump_edit");
                      setStep("draft");
                    }}
                  >
                    {(saved[row.key] ?? []).join(" ")}
                  </button>
                ) : (
                  <p className="mt-2 text-rw-ink/60">{row.notes.slice(0, 1).join(" ").split(/\s+/).slice(0, 12).join(" ") || "Not drafted yet"}</p>
                )}
              </article>
            );
          })}
          <Button type="button" onClick={openNext}>Ready for section {ORDINALS[index + 1] ?? "next"}?</Button>
        </section>
      ) : null}

      {screen === "payoff" ? (
        <section className="space-y-3">
          <h2 className="font-display text-3xl">Look at everything you wrote.</h2>
          <p className="text-sm text-rw-ink/70">This is your whole paper, in your own words.</p>
          {plan.map((row) => (
            <article key={row.key} className="rounded-xl bg-white p-4 text-sm">
              <h3 className="font-medium">{row.title}</h3>
              <p className="mt-2">{(saved[row.key] ?? []).join(" ")}</p>
            </article>
          ))}
          <p className="text-sm">{plan.length} paragraphs · {wordCount(Object.values(saved).flat().join(" "))} words you wrote</p>
          <Button type="button" onClick={() => router.push(`/app/papers/${paperId}/stage/6`)}>On to revision</Button>
        </section>
      ) : null}
    </div>
  );
}
