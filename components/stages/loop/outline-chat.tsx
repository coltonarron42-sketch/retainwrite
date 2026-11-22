"use client";

import { useState } from "react";
import { DsButton } from "@/components/ui/ds-button";
import { SaveStatus } from "@/components/stages/save-status";
import { ComposerDock, EchoBubble, PauPauGroup, PickedChip, ScrollToNewest, StudentBubble } from "@/components/stages/stage1/chat-bubbles";
import { ChatComposer } from "@/components/stages/stage1/chat-composer";
import { ChatHeader, ReplayButton, SpeakNew, useStopSpeechOnUnmount } from "@/components/stages/stage1/voice";
import { keptIdeas } from "@/lib/coaching/thin";
import { dsCaption, dsEyebrow, dsLink } from "@/lib/ds/classes";
import { draftPointer } from "@/lib/papers/draft-resume";
import { useDraftSave } from "@/lib/papers/use-draft-save";
import { nextOutlineIndex, type LoopLine } from "@/lib/stages/stance-turn";
import type { SpeakItem } from "@/lib/voice/speech";
import type { StanceIntent } from "@/lib/stages/stance-intent";

export type OutlineSectionView = { key: string; title: string; needs: string; ideas: string[] };

type Props = {
  paperId: string;
  persist: boolean;
  sections: OutlineSectionView[];
  done: string[];
  transcript: LoopLine[];
  /** Her answer to a request/question, inside the current turn only. */
  aside: { k: string; at: number; paras: string[] } | null;
  classify: (text: string, ask: string) => Promise<StanceIntent>;
  onAside: (intent: StanceIntent, key: string, lines: LoopLine[]) => void;
  /** Sections flagged in Stance where the student chose "Continue anyway": key → reason. */
  flags: Record<string, string>;
  saving: boolean;
  error: string | null;
  skipped: { key: string; title: string }[];
  voiceNote: string | null;
  /** One section's outline, in the student's words (blank or untouched keeps the Stance notes). */
  onSend: (key: string, text: string, lines: LoopLine[]) => void;
  onReopen: (key: string) => void;
  /** All sections done: the old Stage 3 Continue (same saves, same gate). */
  onFinish: () => void;
  onGoBack: (key: string) => void;
};

export const OUTLINE_INTRO =
  "I pulled in your notes from Stance. We'll shape one section at a time into a short outline in your own words: one line per point, your main claim first, then the example that shows it.";

export function outlineAsk(section: OutlineSectionView, first: boolean): string[] {
  const notes = keptIdeas(section.ideas).join(" ");
  return [
    ...(first ? [OUTLINE_INTRO] : []),
    `Let's shape your ${section.title.toLowerCase()} (${section.needs.toLowerCase()}).`,
    notes
      ? "Your Stance notes are in the box. Rework them into outline lines, or keep them as they are."
      : "You don't have notes for this one yet. Write a line or two, or keep going and come back to it.",
  ];
}

/**
 * Stage 3 (Outline) as one-at-a-time Pau Pau turns (PLAN.md 9): the three
 * outline boxes become three questions. The student's outline text is theirs;
 * Pau Pau never writes or rewrites it.
 */
export function OutlineChat(props: Props) {
  const { paperId, sections, done, transcript } = props;
  useStopSpeechOnUnmount();
  const index = nextOutlineIndex(sections, done);
  const current = index >= 0 ? sections[index]! : null;
  const notes = current ? keptIdeas(current.ideas).join("\n") : "";
  // Keep the raw text the student typed (the saved note is trimmed); reset per section.
  const [text, setText] = useState(notes);
  const [forKey, setForKey] = useState(current?.key ?? null);
  if ((current?.key ?? null) !== forKey) {
    setForKey(current?.key ?? null);
    setText(notes);
  }
  const status = useDraftSave({
    paperId,
    fieldKey: `outline:${current?.key ?? "done"}`,
    text,
    enabled: Boolean(props.persist && current),
    resume: draftPointer({ stage: 3, sectionKey: current?.key ?? null }),
  });

  const paras = current
    ? outlineAsk(current, done.length === 0 && transcript.length === 0)
    : ["That's every section outlined. Ready to move on to sources?"];
  const pau = (k: string, t: string): LoopLine => ({ k, who: "pau", text: t });
  const you = (k: string, t: string): LoopLine => ({ k, who: "you", text: t });
  const pick = (k: string, t: string): LoopLine => ({ k, who: "pick", text: t });
  const [checking, setChecking] = useState(false);
  const asideParas = current && props.aside && props.aside.k === current.key && props.aside.at === transcript.length ? props.aside.paras : [];
  const flag = current ? props.flags[current.key] : undefined;
  const turnParas = [...asideParas, ...paras];

  /** A tap keeps the Stance notes (a "Picked" chip); typed words are checked first. */
  async function submit(value: string, tapped: boolean) {
    if (!current || props.saving || checking) return;
    const ask = paras.slice(-2).join(" ");
    if (!tapped && value.trim() && value.trim() !== notes.trim()) {
      setChecking(true);
      const intent = await props.classify(value, ask);
      setChecking(false);
      if (intent !== "content") {
        // Never saved as the outline: answer it and put their notes back in the box.
        props.onAside(intent, current.key, [pau(current.key, ask), you(current.key, value.trim())]);
        setText(notes);
        return;
      }
    }
    props.onSend(current.key, value, [pau(current.key, ask), tapped ? pick(current.key, notes ? "Keep my notes" : "Skip for now") : you(current.key, value.trim() || "Keep my notes")]);
  }

  const speak: SpeakItem[] = [{ key: `s3:${current?.key ?? "done"}:${transcript.length}`, text: turnParas.join(" "), turn: true }];

  const isLastPick = (i: number) => {
    const line = transcript[i]!;
    return done.includes(line.k) && !transcript.slice(i + 1).some((l) => l.k === line.k && (l.who === "you" || l.who === "pick"));
  };

  return (
    <div className="mx-auto max-w-[680px] font-ds-sans text-ds-ink" data-stage-chat="3">
      <SpeakNew scope={`${paperId}:stage3`} items={speak} />
      <ChatHeader eyebrow="Stage 3 · Outline" eyebrowClassName={dsEyebrow} />
      <div className="mt-4 space-y-4" role="log" aria-label="Conversation with Pau Pau">
        {transcript.map((line, i) => {
          const head = i === 0 || transcript[i - 1]!.k !== line.k ? sections.find((s) => s.key === line.k)?.title : null;
          const isLastAnswer = line.who === "you" && isLastPick(i);
          return (
            <div key={i} className="space-y-4">
              {head ? (
                <p className={`text-center ${dsCaption}`}>
                  {head}
                  {props.flags[line.k] ? <span data-flagged> · Flagged in Stance</span> : null}
                </p>
              ) : null}
              {line.who === "pau" ? (
                <PauPauGroup bubbles={[line.text]} showName={i === 0} />
              ) : line.who === "pick" ? (
                <PickedChip
                  label={line.text}
                  fullText={line.text}
                  onEdit={isLastPick(i) ? () => props.onReopen(line.k) : undefined}
                  editLabel={`Edit your outline for ${sections.find((s) => s.key === line.k)?.title ?? "this section"}`}
                />
              ) : isLastAnswer ? (
                <EchoBubble
                  text={line.text}
                  onEdit={() => props.onReopen(line.k)}
                  editLabel={`Edit your outline for ${sections.find((s) => s.key === line.k)?.title ?? "this section"}`}
                />
              ) : (
                <StudentBubble message={{ text: line.text, files: [], at: 0 }} />
              )}
            </div>
          );
        })}

        <PauPauGroup
          showName={transcript.length === 0}
          bubbles={turnParas}
          headingIndex={turnParas.length - 1}
          headingId="outline-question"
          live
        >
          {current ? (
            <>
              <p className={dsCaption} data-section-step>
                Section {index + 1} of {sections.length} · {current.title}
              </p>
              {flag ? (
                <p className="border-l-2 border-ds-accent pl-3 text-[16px]" data-flag>
                  Flagged in Stance: {flag} You chose to keep going, so give this section another look as you outline it.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Outline choices">
                <DsButton type="button" size="sm" variant="secondary" disabled={props.saving} onClick={() => void submit(notes, true)}>
                  {notes ? "Keep my notes" : "Skip for now"}
                </DsButton>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <DsButton type="button" disabled={props.saving} onClick={props.onFinish}>
                Continue to sources
              </DsButton>
            </div>
          )}
          {props.error ? (
            <p role="alert" className="text-ds-error">
              {props.error}
            </p>
          ) : null}
          {props.voiceNote ? <p className="border-t border-ds-border pt-3 text-ds-muted" data-voice-note="reply">{props.voiceNote}</p> : null}
          {props.skipped.length ? (
            <div className="space-y-1 border-t border-ds-border pt-3 text-[16px]">
              {props.skipped.map((item) => (
                <p key={item.key}>
                  You skipped {item.title}. It needs to be finished before you start your draft.{" "}
                  <button type="button" className={`ds-focus min-h-[48px] ${dsLink}`} onClick={() => props.onGoBack(item.key)}>
                    Go back to {item.title}
                  </button>
                </p>
              ))}
            </div>
          ) : null}
          <ReplayButton texts={[turnParas.join(" ")]} className="-ml-2" />
        </PauPauGroup>
        <ScrollToNewest signal={`${transcript.length}:${current?.key ?? "done"}:${props.error ?? ""}`} />
      </div>

      {current ? (
        <ComposerDock>
          <ChatComposer
            paperId={paperId}
            labelledBy="outline-question"
            value={text}
            onChange={setText}
            minRows={3}
            enterSends={false}
            sending={props.saving || checking}
            placeholder="One line per point, in your words"
            onSend={() => void submit(text, false)}
          />
          <SaveStatus status={status} />
        </ComposerDock>
      ) : null}
    </div>
  );
}
