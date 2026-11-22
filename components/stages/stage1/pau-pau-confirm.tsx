"use client";

import { useRef, useState } from "react";
import { DsButton } from "@/components/ui/ds-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { extractFileText } from "@/lib/assignment/client-extract";
import { markFieldConfirmed } from "@/lib/assignment/confirm";
import { dsCaption, dsInput, dsTextarea } from "@/lib/ds/classes";
import { PauPauAvatar } from "@/components/stages/stage1/chat-bubbles";
import { ReplayButton, SpeakNew } from "@/components/stages/stage1/voice";
import type { AssignmentRequirements, ProvidedReading } from "@/lib/assignment/schema";
import {
  COACH_NAME,
  PAU_PAU_ASK_TEXT,
  lengthFromAnswer,
  pauPauNextAsk,
  pauPauSummaryBubbles,
  type PauPauAsk,
} from "@/lib/stage1/pau-pau";

type Props = {
  paperId: string;
  requirements: AssignmentRequirements;
  onChange: (next: AssignmentRequirements) => void;
  onConfirm: () => void;
  onEditDetails: () => void;
  onStartOver: () => void;
  confirming: boolean;
  error: string | null;
  /** Inside the chat frame: the name line is already above, on the first bubble. */
  embedded?: boolean;
};

export { PauPauAvatar };

/**
 * After the read: Pau Pau says back what it understood, asks for the one most
 * important missing thing, and "Let's go" confirms the same structured card.
 */
export function PauPauConfirm({
  paperId,
  requirements,
  onChange,
  onConfirm,
  onEditDetails,
  onStartOver,
  confirming,
  error,
  embedded = false,
}: Props) {
  const [dismissed, setDismissed] = useState<Set<PauPauAsk>>(new Set());
  const [answer, setAnswer] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const ask = pauPauNextAsk(requirements, dismissed);
  // Same paper → same opener, so a reload reads the same.
  const bubbles = pauPauSummaryBubbles(requirements, { pendingAsk: ask, seed: paperId });
  const askText = ask ? PAU_PAU_ASK_TEXT[ask] : null;

  function nextAsk(after: PauPauAsk, note: string | null) {
    setAnswer("");
    setLinkOpen(false);
    setAskError(null);
    setThanks(note);
    setDismissed((prev) => new Set(prev).add(after));
  }

  function addReading(reading: ProvidedReading) {
    const list = [...(requirements.providedReadings.value ?? []), reading];
    const field = markFieldConfirmed(requirements.providedReadings, { value: list });
    onChange({ ...requirements, providedReadings: field, providedSources: field });
    // Keep it on the saved assignment so a reload doesn't ask again.
    void fetch(`/api/papers/${paperId}/assignment/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", readings: list }),
    }).catch(() => undefined);
  }

  function saveTopic() {
    const text = answer.replace(/\s+/g, " ").trim();
    if (text.split(" ").length < 3) {
      setAskError("A few words is enough, but I need at least that much.");
      return;
    }
    onChange({ ...requirements, topic: markFieldConfirmed(requirements.topic, { value: text }) });
    nextAsk("topic", "Got it, thanks.");
  }

  async function saveLink() {
    const url = answer.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(url)) {
      setAskError("That doesn't look like a web link. It should start with http:// or https://.");
      return;
    }
    setChecking(true);
    setAskError(null);
    const check = (await fetch(`/api/papers/${paperId}/assignment/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", url }),
    })
      .then((res) => res.json())
      .catch(() => null)) as { ok?: boolean; reason?: string } | null;
    setChecking(false);
    if (!check?.ok) {
      setAskError(
        check?.reason === "not_found"
          ? "I couldn't open that link: the page says it doesn't exist. Double-check it and try again, or upload the PDF instead."
          : "I couldn't open that link. Double-check it and try again, or upload the PDF instead.",
      );
      return;
    }
    addReading({ url, origin: "manual" });
    nextAsk("sources", "Nice, I've got that source.");
  }

  async function uploadSource(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setAskError(null);
    // Title from the file's own first line; the student's file name otherwise.
    const read = await extractFileText(paperId, file).catch(() => null);
    const firstLine = read && read.ok ? read.text.split(/\n/).map((l) => l.trim()).find((l) => l.length >= 6) : null;
    addReading({
      title: (firstLine && firstLine.length <= 140 ? firstLine : file.name).slice(0, 300),
      notes: `Uploaded file: ${file.name}`,
      origin: "manual",
    });
    setBusy(false);
    nextAsk("sources", `Nice, I've got ${file.name}.`);
  }

  function saveLength() {
    const value = lengthFromAnswer(answer);
    if (!value || (!value.wordsMin && !value.pagesMin)) {
      setAskError("Try a number, like 1,200 words or 5 pages.");
      return;
    }
    onChange({ ...requirements, length: markFieldConfirmed(requirements.length, { value }) });
    nextAsk("length", "Perfect.");
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <div className="flex items-start gap-2 sm:gap-3">
        <PauPauAvatar />
        <div className="min-w-0 flex-1">
          {embedded ? null : (
            <p className="text-[13px] font-semibold uppercase tracking-wider text-ds-muted">
              {COACH_NAME} <span className="font-normal normal-case tracking-normal">· your writing coach</span>
            </p>
          )}
          <div className="mt-2 space-y-2" aria-live="polite">
            <h1 className="sr-only">{COACH_NAME} read your assignment</h1>
            {bubbles.map((text, i) => (
              <div key={i}>
                <p className="inline-block max-w-full rounded-[12px] rounded-tl-[4px] border border-ds-border bg-ds-surface px-4 py-3 text-[18px] leading-[1.6] text-ds-ink shadow-ds-card sm:px-5 sm:py-4">
                  {text}
                </p>
              </div>
            ))}
            {thanks ? (
              <div>
                <p className="inline-block max-w-full rounded-[12px] rounded-tl-[4px] border border-ds-border bg-ds-surface px-4 py-3 text-[18px] leading-[1.6] text-ds-ink shadow-ds-card sm:px-5 sm:py-4">
                  {thanks}
                </p>
              </div>
            ) : null}
            {askText ? (
              <div>
                <p className="inline-block max-w-full rounded-[12px] rounded-tl-[4px] border border-ds-border bg-ds-surface px-4 py-3 text-[18px] leading-[1.6] text-ds-ink shadow-ds-card sm:px-5 sm:py-4">
                  {askText}
                </p>
              </div>
            ) : null}
          </div>

          <SpeakNew
            scope={paperId}
            items={[
              ...bubbles.map((text, i) => ({ key: `sum:${i}`, text, turn: true })),
              ...(thanks ? [{ key: `thanks:${thanks}`, text: thanks, turn: true }] : []),
              ...(askText && ask ? [{ key: `ask:${ask}`, text: askText, turn: true }] : []),
            ]}
          />
          <ReplayButton
            className="mt-1 -ml-2"
            texts={[...bubbles, thanks, askText].filter((t): t is string => Boolean(t))}
          />

          {ask === "topic" ? (
            <div className="mt-4 space-y-2">
              <Textarea
                className={dsTextarea}
                rows={3}
                aria-label="The prompt or topic"
                placeholder="Paste the prompt, or describe the topic"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <DsButton type="button" variant="secondary" onClick={saveTopic}>
                Save the topic
              </DsButton>
            </div>
          ) : null}

          {ask === "sources" ? (
            <div className="mt-4 space-y-3">
              {linkOpen ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    className={`${dsInput} flex-1`}
                    type="url"
                    inputMode="url"
                    aria-label="Source link"
                    placeholder="https://"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !checking) void saveLink();
                    }}
                  />
                  <DsButton type="button" variant="secondary" disabled={checking} onClick={() => void saveLink()}>
                    {checking ? "Checking…" : askError ? "Try again" : "Add link"}
                  </DsButton>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {!linkOpen ? (
                  <DsButton type="button" size="sm" variant="secondary" onClick={() => setLinkOpen(true)}>
                    Add a link
                  </DsButton>
                ) : null}
                <DsButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  {busy ? "Reading the file…" : "Upload a PDF"}
                </DsButton>
                <DsButton type="button" size="sm" variant="ghost" onClick={() => nextAsk("sources", null)}>
                  Not now
                </DsButton>
              </div>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.md,.html,application/pdf"
                onChange={(e) => {
                  void uploadSource(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          ) : null}

          {ask === "length" ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                className={`${dsInput} flex-1`}
                aria-label="Paper length"
                placeholder="e.g. 1,200 words or 5 pages"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveLength();
                }}
              />
              <div className="flex gap-2">
                <DsButton type="button" variant="secondary" onClick={saveLength}>
                  Save
                </DsButton>
                <DsButton type="button" size="sm" variant="ghost" onClick={() => nextAsk("length", null)}>
                  Skip
                </DsButton>
              </div>
            </div>
          ) : null}

          {askError ? (
            <p className="mt-2 text-[16px] leading-[1.6] text-ds-error" role="alert">
              {askError}
            </p>
          ) : null}
          {error ? (
            <p id="confirm-error" className="mt-4 text-[16px] leading-[1.6] text-ds-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <DsButton
              type="button"
              variant="primary"
              disabled={confirming || ask === "topic"}
              onClick={onConfirm}
            >
              {confirming ? "Saving…" : "Let's go"}
            </DsButton>
            <DsButton type="button" size="sm" variant="ghost" onClick={onEditDetails}>
              Fix something
            </DsButton>
          </div>
          <p className={`mt-6 ${dsCaption}`}>
            Wrong file?{" "}
            <button type="button" className="font-semibold text-ds-ink underline underline-offset-4" onClick={onStartOver}>
              Upload a different one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
