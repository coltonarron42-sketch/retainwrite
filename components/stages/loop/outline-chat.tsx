"use client";

import { SourceHintCard } from "@/components/stages/source-hint";
import { sourceHintsFor } from "@/lib/coaching/source-hints";
import type { MaterialSummary } from "@/lib/stage1/paper-context";
import { useEffect, useRef, useState } from "react";
import { withoutClosingQuestion } from "@/lib/copy/sentences";
import { readScoped, writeScoped } from "@/lib/local/user-scope";
import { DsButton } from "@/components/ui/ds-button";
import { SaveStatus } from "@/components/stages/save-status";
import { ComposerDock, EchoBubble, PauPauGroup, PickedChip, ScrollToNewest, StudentBubble } from "@/components/stages/stage1/chat-bubbles";
import { FocusOpener, useFocusReturn } from "@/components/stages/stage1/welcome-back";
import { FocusBar, PastChatPanel, withEarlier, type PastLine, type SkeletonWords } from "@/components/stages/focus-panels";
import { openSkeleton } from "@/lib/skeleton/live";
import { pastLines } from "@/components/stages/loop/stance-chat";
import type { SkeletonView } from "@/lib/skeleton/shape";
import { ChatComposer } from "@/components/stages/stage1/chat-composer";
import { IntentWarm } from "@/components/stages/loop/stance-chat";
import { ChatHeader, ReplayButton, SpeakNew, useStopSpeechOnUnmount } from "@/components/stages/stage1/voice";
import { keptIdeas } from "@/lib/coaching/thin";
import { dsCaption, dsEyebrow, dsLink } from "@/lib/ds/classes";
import { draftPointer } from "@/lib/papers/draft-resume";
import { useDraftSave } from "@/lib/papers/use-draft-save";
import { nextOutlineIndex, type LoopLine } from "@/lib/stages/stance-turn";
import type { SpeakItem } from "@/lib/voice/speech";
import { OUTLINE_FOLLOW_UP, type StanceIntent } from "@/lib/stages/stance-intent";
import { sectionPurpose } from "@/lib/stage1/paper-context";
import { RealtimeControls, useRealtimeCall, useRealtimeEnabled } from "@/components/stages/loop/realtime-voice";
import { LiveTurns } from "@/components/stages/loop/live-turns";
import { sectionLabel } from "@/lib/coach/welcome-back";
import { isQuickConfirm } from "@/lib/stage1/confirm-reply";
import { isControlPhrase, isSaidToCoach } from "@/lib/stage1/voice-turn";
import { addSpokenLine, outlineChoiceSaid, splitOutlineControl } from "@/lib/stages/outline-voice";
import { outlineGap, outlineMap, outlinePoints } from "@/lib/stages/outline-map";

export type OutlineSectionView = { key: string; title: string; needs: string; ideas: string[] };

type Props = {
  paperId: string;
  /** P3: the paper's stored sources, placed per section. */
  sources?: MaterialSummary[];
  persist: boolean;
  sections: OutlineSectionView[];
  done: string[];
  transcript: LoopLine[];
  /** Her answer to a request/question, inside the current turn only. */
  aside: { k: string; at: number; paras: string[]; intent?: StanceIntent } | null;
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
  /** Grok Voice on Stage 3: only while the paper is in Stage 3 (not a read-only past stage). */
  voice?: boolean;
  /** Their Stage 1 pick ("Transformational"), so the coaching names it (QA 10:21). */
  pick?: string | null;
  /** PC-28: the paper's skeleton (labels/titles) and the student's own words for it. */
  skeleton?: { view: SkeletonView | null; words: SkeletonWords; direction?: string | null };
  /** QA 1:11 AM #8: Stage 1 and Stage 2 for Past chat, so it's there on the first Stage 3 view. */
  earlier?: PastLine[];
};

export const OUTLINE_INTRO =
  "I pulled in your notes from Stance. We'll shape one section at a time into a short outline in your own words: one line per point, your main claim first, then the example that shows it.";

/** The section intro line (once per section in the conversation). */
export function sectionIntroLine(section: OutlineSectionView): string {
  return `Let's shape your ${section.title.toLowerCase()} (${section.needs.toLowerCase()}).`;
}

/** What this section is for, taught before she asks (north star E; QA 11/23 #4). */
export function sectionTeachLine(section: OutlineSectionView): string {
  return `${sectionPurpose(section.title)} A good outline line here is short: your point, plus the reason or example that backs it.`;
}

/**
 * Has this section's intro already been said in the saved conversation (by
 * section id)? Then a remount, a late restore or a toggle during hydration
 * never says it again (QA 5:44 PM: a duplicate intro on reopen).
 */
export function introInHistory(transcript: LoopLine[], section: OutlineSectionView): boolean {
  const intro = sectionIntroLine(section);
  return transcript.some((line) => line.who === "pau" && line.k === section.key && line.text.includes(intro));
}

/** Their thesis for the gap check: the Introduction's notes, in their words. */
export function thesisFrom(sections: { title: string; ideas: string[] }[]): string | null {
  const intro = sections.find((s) => /intro/i.test(s.title));
  const t = intro ? keptIdeas(intro.ideas).join(" ").trim() : "";
  return t || null;
}

/** No gap: still grounded in their own words (QA 10:21 #5), never a bare template. */
function doneLine(title: string, ideas: string[]): string {
  const first = (ideas[0] ?? "").replace(/\s+/g, " ").trim();
  if (!first) return "";
  // A whole sentence, never cut mid-thought.
  const cut = (first.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? first).replace(/[.!?]+$/, "");
  return `Your ${title.toLowerCase()} already has what it needs, starting with “${cut}”.`;
}

export function outlineAsk(section: OutlineSectionView, first: boolean, introSaid = false, thesis: string | null = null, allNotes: string | null = null, pick: string | null = null): string[] {
  const notes = keptIdeas(section.ideas).join(" ");
  const gap = notes ? outlineGap(section.title, outlinePoints(keptIdeas(section.ideas).join("\n")), thesis, allNotes, pick) : null;
  return [
    ...(first && !introSaid ? [OUTLINE_INTRO] : []),
    introSaid ? `Back to your ${section.title.toLowerCase()}.` : `${sectionIntroLine(section)} ${sectionTeachLine(section)}`,
    notes
      ? // QA 7:11 AM: she coaches the gap she sees in their outline for this section.
        `${gap ? `${gap} ` : `${doneLine(section.title, keptIdeas(section.ideas))} `}Your Stance notes are in the box. Rework them into outline lines, or keep them as they are.`
      : "You don't have notes for this one yet. Write a line or two, or keep going and come back to it.",
  ];
}

/**
 * Stage 3 (Outline) as one-at-a-time Pau turns (PLAN.md 9): the three
 * outline boxes become three questions. The student's outline text is theirs;
 * Pau never writes or rewrites it.
 */
export function OutlineChat(props: Props) {
  const { paperId, sections, done, transcript } = props;
  useStopSpeechOnUnmount();
  const index = nextOutlineIndex(sections, done);
  const current = index >= 0 ? sections[index]! : null;
  const notes = current ? keptIdeas(current.ideas).join("\n") : "";
  // Keep the raw text the student typed (the saved note is trimmed). The box is
  // prefilled with a section's notes ONCE (QA 5:44 PM): a remount, a restore or
  // a Voice/Mute toggle during hydration brings back what was in the box, never
  // the notes again over it.
  // The box and the section it belongs to change together (the draft save
  // sees one switch, not an edit).
  const curKey = current?.key ?? null;
  const [boxState, setBoxState] = useState<{ key: string | null; text: string }>(() => ({
    key: curKey,
    text: current ? composerText(paperId, current.key, notes) : "",
  }));
  useEffect(() => {
    // A new section: its box, read once here (never during render).
    if (boxState.key === curKey) return;
    setBoxState({ key: curKey, text: curKey ? composerText(paperId, curKey, notes) : "" });
    // notes are read for the section that just opened only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, curKey]);
  const text = boxState.key === curKey ? boxState.text : "";
  const setText = (next: string) => {
    setBoxState({ key: curKey, text: next });
    if (curKey) rememberComposer(paperId, curKey, next, notes);
  };

  const status = useDraftSave({
    paperId,
    fieldKey: `outline:${boxState.key ?? "done"}`,
    text: boxState.text,
    enabled: Boolean(props.persist && current && boxState.key === curKey),
    resume: draftPointer({ stage: 3, sectionKey: current?.key ?? null }),
  });

  // PC-28: a return with history opens a clean chat: one welcome line, then the exact section they were on.
  const lastDone = [...sections].reverse().find((x) => done.includes(x.key));
  const [openerOpen, setOpenerOpen] = useState(false);
  const focus = useFocusReturn(paperId, true, transcript.some((l) => l.who !== "pau") || done.length > 0, {
    done: lastDone ? `outlining ${sectionLabel(lastDone.title)}` : null,
    next: current ? sectionLabel(current.title) : "moving on to sources",
  });
  const welcomeLine = focus.line;
  const [mountAt] = useState(transcript.length);
  // When the chat is focused, the earlier intro is off screen: she restates the full prompt.
  const seen = focus.focused ? transcript.slice(mountAt) : transcript;
  const paras = current
    ? outlineAsk(current, done.length === 0 && transcript.length === 0, introInHistory(seen, current), thesisFrom(sections), sections.map((x) => keptIdeas(x.ideas).join(" ")).join(" "), props.pick ?? null)
    : ["That's every section outlined. Ready to move on to sources?"];
  const pau = (k: string, t: string): LoopLine => ({ k, who: "pau", text: t });
  const you = (k: string, t: string): LoopLine => ({ k, who: "you", text: t });
  const pick = (k: string, t: string): LoopLine => ({ k, who: "pick", text: t });
  const [checking, setChecking] = useState(false);
  const asideHere = Boolean(current && props.aside && props.aside.k === current.key && props.aside.at === transcript.length);
  const asideParas = asideHere ? props.aside!.paras : [];
  const flag = current ? props.flags[current.key] : undefined;
  // Her answers at the end of the transcript (append-only) are the top of this reply.
  let tail = transcript.length;
  while (current && tail > 0 && transcript[tail - 1]!.who === "pau" && transcript[tail - 1]!.k === current.key) tail -= 1;
  const trailing = transcript.slice(tail).map((line) => line.text);
  const shown = transcript.slice(0, tail);
  // After an answer she doesn't re-ask the whole opener.
  const ask = asideHere ? [OUTLINE_FOLLOW_UP] : paras;
  const turnParasAll = [...trailing, ...asideParas, ...ask];
  const turnParas = openerOpen ? withoutClosingQuestion(turnParasAll) : turnParasAll;

  /** A tap keeps the Stance notes (a "Picked" chip); typed words are checked first. */
  async function submit(value: string, tapped: boolean) {
    if (!current || props.saving || checking) return;
    const askText = ask.slice(-2).join(" ");
    if (!tapped && value.trim() && value.trim() !== notes.trim()) {
      setChecking(true);
      const intent = await props.classify(value, askText);
      setChecking(false);
      if (intent !== "content") {
        // Never saved as the outline: answer it and put their notes back in the box.
        props.onAside(intent, current.key, [pau(current.key, askText), you(current.key, value.trim())]);
        setText(notes);
        return;
      }
    }
    props.onSend(current.key, value, [pau(current.key, askText), tapped ? pick(current.key, notes ? "Keep my notes" : "Skip for now") : you(current.key, value.trim() || "Keep my notes")]);
  }

  const [panel, setPanel] = useState<"skeleton" | "past" | null>(null);
  // Grok Voice (Colton, Nov 23): same relay as Stages 1-2. Spoken words land in the
  // box word for word; her "move on" sends the box through submit() (same intent
  // check, same saves and gates as typing); a strict yes is the only spoken advance.
  const rtMode = useRealtimeEnabled(paperId) && Boolean(props.voice);
  const voiceRef = useRef<(text: string, kind?: string) => Promise<string>>(async () => "ignored");
  const textRef = useRef(text);
  const submitBusy = useRef(0);
  const mountLen = useRef(transcript.length);
  const rt = useRealtimeCall({
    paperId,
    stage: 3,
    saveNote: async (spoken, kind) => {
      if (kind === "submit") submitBusy.current = Date.now() + 60_000;
      try {
        const result = await voiceRef.current(spoken, kind);
        return { ok: true, result, screen: screenRef.current.text };
      } finally {
        if (kind === "submit") submitBusy.current = Date.now() + 1_500;
      }
    },
    welcome: () => ({
      welcome: Boolean(welcomeLine) && transcript.length === mountLen.current,
      index: focus.index,
      text: welcomeLine,
    }),
  });
  const choice = current ? (notes ? "Keep my notes" : "Skip for now") : "Continue to sources";
  // Their own lines (typed or spoken) are in the box: Keep my notes / Skip would replace them, so Pau isn't told to offer it.
  const ownLines = Boolean(current && text.trim() && text.trim() !== notes.trim());
  const rtChoices = current && ownLines ? [] : [choice];
  const screenText = [
    current ? `Section ${index + 1} of ${sections.length}: ${current.title}.` : null,
    ...turnParas,
    props.error ? `(App note shown to the student: ${props.error})` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const rtKey = `${curKey ?? "done"}:${transcript.length}:${asideHere ? 1 : 0}`;
  const screenRef = useRef({ key: rtKey, text: screenText, section: curKey });
  useEffect(() => {
    screenRef.current = { key: rtKey, text: screenText, section: curKey };
    textRef.current = text;
  });
  useEffect(() => {
    voiceRef.current = async (spoken, kind) => {
      // Moved on = the open section changed (an answered aside changes the turn, not the section).
      const before = screenRef.current.section;
      const moved = async (ms = 1000) => {
        for (let i = 0; i < ms / 50; i++) {
          if (screenRef.current.section !== before) return "saved";
          await new Promise((r) => setTimeout(r, 50));
        }
        return "needs_more";
      };
      if (!current) {
        if (kind === "submit") return (await moved(2500)) === "saved" ? "saved" : "nothing_to_submit";
        // The finish step: the same strict yes as typing; anything else is just talk.
        if (!isQuickConfirm(spoken) || props.saving) return "aside";
        props.onFinish();
        return "moving_on";
      }
      if (kind === "submit") {
        const box = textRef.current.trim();
        if (!box) return "empty";
        await submit(box, box === notes.trim());
        return moved(3000);
      }
      const said = outlineChoiceSaid(spoken, Boolean(notes));
      if (said) {
        await submit(notes, true);
        return moved();
      }
      // Requests to Pau are answered by her, never saved as their outline.
      if (isSaidToCoach(spoken)) return "said_to_coach";
      // "That's my outline for this section" / "let's move on" is said to her, not outline content.
      const { line } = splitOutlineControl(spoken);
      if (!line || isControlPhrase(line)) return "move_on_words";
      const next = addSpokenLine(textRef.current, line, notes);
      textRef.current = next;
      setText(next);
      return "in_box";
    };
  });
  const rtSeen = useRef<string | null>(null);
  useEffect(() => {
    if (!rt.on) {
      rtSeen.current = null;
      return;
    }
    if (rtSeen.current === null || rtSeen.current === rtKey) {
      rtSeen.current = rtKey;
      rt.setScreen(screenText, rtChoices);
      return;
    }
    rtSeen.current = rtKey;
    rt.clearLive();
    rt.setScreen(screenText, rtChoices);
    // Her own submit_answer already carries the next step.
    if (Date.now() < submitBusy.current) return;
    rt.sayTurn(screenText);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per step
  }, [rtKey, rt.on]);
  // Typing (or speaking) their own lines takes Keep my notes off what Pau offers.
  useEffect(() => {
    if (rt.on && rtSeen.current === rtKey) rt.setScreen(screenText, rtChoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when it flips
  }, [ownLines]);

  const speak: SpeakItem[] = rtMode ? [] : [{ key: `s3:${current?.key ?? "done"}:${transcript.length}`, text: turnParas.join(" "), turn: true }];

  const focusFrom = focus.focused ? mountAt : 0;
  const firstShown = current ? shown.findIndex((l, i) => l.k === current.key && i >= focusFrom) : -1;
  const isLastPick = (i: number) => {
    const line = transcript[i]!;
    return done.includes(line.k) && !transcript.slice(i + 1).some((l) => l.k === line.k && (l.who === "you" || l.who === "pick"));
  };

  return (
    <div className="mx-auto max-w-[680px] font-ds-sans text-ds-ink" data-stage-chat="3">
      <SpeakNew scope={`${paperId}:stage3`} items={speak} />
      <ChatHeader eyebrow="Stage 3 · Outline" eyebrowClassName={dsEyebrow} hideVoice={rtMode} />
      {/* QA 7:11 AM: the mapped outline, visible and editable: each section, its purpose, their points in their words. */}
      <FocusBar onPast={() => setPanel("past")} hasPast={transcript.length > 0 || Boolean(props.earlier?.length)} />
      {panel === "past" ? <PastChatPanel lines={withEarlier(props.earlier ?? [], pastLines(transcript, sections), "Stage 3 · Outline")} onClose={() => setPanel(null)} /> : null}
      {/* PC-28: the outline so far stays one tap away (collapsed), never stacked above the prompt. */}
      <details className="mt-4 rounded-md border border-ds-border p-4" aria-label="Your outline" data-outline-map>
        <summary className={`ds-focus cursor-pointer ${dsEyebrow}`}>Your outline so far ({done.length} of {sections.length})</summary>
        <ol className="mt-2 space-y-3">
          {outlineMap(sections, done, current ? { key: current.key, text } : null).map((row) => (
            <li key={row.key} data-outline-row={row.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{row.title}{row.current ? <span className={`ml-2 ${dsCaption}`}>(open now)</span> : null}</p>
                {row.done ? (
                  <button type="button" className={`ds-focus min-h-[48px] ${dsLink}`} onClick={() => props.onReopen(row.key)}>
                    Edit
                  </button>
                ) : row.current ? (
                  <button
                    type="button"
                    className={`ds-focus min-h-[48px] ${dsLink}`}
                    onClick={() => {
                      const all = document.querySelectorAll<HTMLTextAreaElement>("textarea");
                      all[all.length - 1]?.focus();
                    }}
                  >
                    Edit in the box
                  </button>
                ) : null}
              </div>
              <p className={dsCaption}>{row.purpose}</p>
              {row.points.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[16px]">
                  {row.points.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[16px] text-ds-muted">No points yet.</p>
              )}
            </li>
          ))}
        </ol>
      </details>
      <div className="mt-4 space-y-4" role="log" aria-label="Conversation with Pau">
        <FocusOpener line={welcomeLine} scope={`${paperId}:stage3`} signal={`${transcript.length}:${done.length}`} silent={rtMode} onProgress={openSkeleton} onOpen={setOpenerOpen} />
        {shown.map((line, i) => {
          // PC-28 one section at a time: only this section's turns, and on a return only what's said since.
          if (!current || line.k !== current.key || i < focusFrom) return null;
          const head = i === firstShown ? sections.find((s) => s.key === line.k)?.title : null;
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
                <PauPauGroup bubbles={[line.text]} showName={i === 0 && !focus.focused} />
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
          showName={firstShown < 0 && !focus.focused}
          bubbles={turnParas}
          headingIndex={turnParas.length - 1}
          headingId="outline-question"
          live
        >
          {current ? (
            <>
              <p className={dsCaption} data-section-step data-section-key={current.key} data-outline-current={current.key}>
                Section {index + 1} of {sections.length} · {current.title}
              </p>
              {/* P3: at the section's first outline prompt, the source to cite on this line. */}
              {!transcript.some((l) => l.who !== "pau" && l.k === current.key) ? (
                <SourceHintCard stage={3} sectionTitle={current.title} hints={sourceHintsFor(current, sections, props.sources)} />
              ) : null}
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
              {rtMode ? <RealtimeControls call={rt} /> : null}
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
        {rtMode ? <LiveTurns rows={rt.live} /> : null}
        <ScrollToNewest signal={`${transcript.length}:${current?.key ?? "done"}:${props.error ?? ""}`} />
        <IntentWarm idea={current && text.trim() !== notes.trim() ? text : ""} ask={ask.slice(-2).join(" ")} classify={props.classify} />
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
            realtimeSlot={rtMode ? <RealtimeControls call={rt} /> : undefined}
          />
          <SaveStatus status={status} />
        </ComposerDock>
      ) : null}
    </div>
  );
}

/* ---- the box's text per section, kept across remounts (QA 5:44 PM) ---- */
type Box = { n: string; t: string };
const boxName = (paperId: string) => `outline-box:${paperId}`;
function readBoxes(paperId: string): Record<string, Box> {
  try {
    const v = JSON.parse(readScoped(boxName(paperId)) ?? "null") as unknown;
    return v && typeof v === "object" ? (v as Record<string, Box>) : {};
  } catch {
    return {};
  }
}
function writeBox(paperId: string, key: string, box: Box) {
  const boxes = readBoxes(paperId);
  const cur = boxes[key];
  if (cur && cur.n === box.n && cur.t === box.t) return;
  boxes[key] = box;
  writeScoped(boxName(paperId), JSON.stringify(boxes));
}
/**
 * What the box shows for a section: what was last in it, or, the first time
 * only, the section's notes (and that prefill is remembered). If the saved
 * notes changed since (another device), the newer saved notes win.
 */
export function composerText(paperId: string, key: string, notes: string): string {
  const box = readBoxes(paperId)[key];
  if (box && typeof box.t === "string" && box.n === notes) return box.t;
  writeBox(paperId, key, { n: notes, t: notes });
  return notes;
}
export function rememberComposer(paperId: string, key: string, text: string, notes: string) {
  const box = readBoxes(paperId)[key];
  writeBox(paperId, key, { n: box?.n ?? notes, t: text });
}
