"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from "react";
import { DsButton } from "@/components/ui/ds-button";
import { SaveStatus } from "@/components/stages/save-status";
import { ComposerDock, PauPauGroup, PickedChip, ScrollToNewest, StudentBubble } from "@/components/stages/stage1/chat-bubbles";
import { FocusOpener, useFocusReturn } from "@/components/stages/stage1/welcome-back";
import { FocusBar, PastChatPanel, SkeletonPanel, type PastLine, type SkeletonWords } from "@/components/stages/focus-panels";
import type { SkeletonView } from "@/lib/skeleton/shape";
import { ChatComposer } from "@/components/stages/stage1/chat-composer";
import { ChatHeader, ReplayButton, SpeakNew, useStopSpeechOnUnmount } from "@/components/stages/stage1/voice";
import { asHeading } from "@/lib/copy/topic-phrase";
import { dsCaption, dsEyebrow, dsLink, dsSelect } from "@/lib/ds/classes";
import type { PreparedLead } from "@/lib/coaching/leadBatch";
import {
  LOGIC_ALERT_LABEL,
  LOGIC_MODERATE_TITLE,
  LOGIC_PASS,
  LOGIC_WRITER,
  LOGIC_CONTINUE,
  LOGIC_STRONG_DETAIL,
  LOGIC_STRONG_HEADLINE,
  LOGIC_TWEAK,
  LOGIC_YES,
} from "@/lib/coaching/logicCheck";
import { oneQuipParas, quipFor } from "@/lib/coach/quips";
import { isVagueNote } from "@/lib/coach/answer";
import { dropBarePraise, mayNeedLookup, sectionPurpose } from "@/lib/stage1/paper-context";
import { LESSON_PROBE_OPENER, MEMORY_CONFIRM, MEMORY_PROBE_OPENER } from "@/lib/coaching/memoryPath";
import { MEMORY_TRIGGER_INTRO, SCRIPTED_MEMORY_FOLLOW_UP, type MemoryTrigger } from "@/lib/coaching/memoryTriggers";
import { lessonLinkFor } from "@/lib/coaching/sourceCard";
import { KNOW_THIS_ONE, SOMETHING_ELSE, TEACH_FOOTER, type TeachCard } from "@/lib/coaching/teach";
import { discussionLine, isPlainYes, isSpokenYes, isSwapNo, isSwapYes, replacementText, substantiveNote, SWAP_ASK, type LoopLine, type StanceTurnKind } from "@/lib/stages/stance-turn";
import { wordCount } from "@/lib/utils";
import { asideFollowUp, type IntentTurn, type StanceIntent } from "@/lib/stages/stance-intent";
import type { SaveStatusValue as DraftSaveStatus } from "@/lib/papers/use-draft-save";
import type { SpeakItem } from "@/lib/voice/speech";
import { sectionLabel } from "@/lib/coach/welcome-back";
import { RealtimeControls, useRealtimeCall, useRealtimeEnabled } from "@/components/stages/loop/realtime-voice";
import { LiveTurns } from "@/components/stages/loop/live-turns";


/** Typing pause before the intent check starts early. */
export const INTENT_WARM_MS = 600;

/**
 * Typed-send latency (QA 8:08 PM): when typing pauses, start the intent check
 * for those exact words so Send usually finds it already answered.
 */
export function IntentWarm(props: { idea: string; ask: string; classify: (text: string, ask: string) => Promise<unknown> }) {
  const { idea, ask, classify } = props;
  const classifyRef = useRef(classify);
  useEffect(() => {
    classifyRef.current = classify;
  });
  useEffect(() => {
    const text = idea.trim();
    if (wordCount(text) < 2) return;
    const timer = setTimeout(() => void classifyRef.current(text, ask), INTENT_WARM_MS);
    return () => clearTimeout(timer);
  }, [idea, ask]);
  return null;
}
export type LogicChoice = "yes" | "tweak" | "keep" | "adjust" | "new_angle" | "revise" | "reframe" | "continued";

export type StanceSectionView = {
  key: string;
  title: string;
  needs: string;
  mode: "lesson" | "memory";
  status: string;
  concept: string | null;
  teachAspect: string | null;
  chosenLead: string | null;
  logic: {
    result: {
      tier: "pass" | "moderate" | "strong";
      basis?: string;
      reason?: string;
      studentClaimRef?: { quote?: string } | null;
      citedTerm?: { quote?: string } | null;
      alternativeAngles: { question: string }[];
    };
  } | null;
};

export type StanceHandlers = {
  teachAspect: (aspect: string, lines: LoopLine[]) => void;
  teachSkip: (lines: LoopLine[]) => void;
  mirrorSave: (lines: LoopLine[], text?: string) => void | Promise<unknown>;
  /** Typed words saved as the note. fromTeach: typed over the teach chips; replace: typed over a choice turn (a revised claim). */
  probeSave: (lines: LoopLine[], opts?: { fromTeach?: boolean; replace?: boolean; text?: string; append?: boolean }) => void | Promise<unknown>;
  followUpAspect: (aspect: string) => void;
  followUpSkip: () => void;
  triggerPick: (trigger: MemoryTrigger) => void;
  triggerHide: (trigger: MemoryTrigger) => void;
  triggersSkip: () => void;
  nameLead: (text: string, lines: LoopLine[]) => void;
  pickLead: (lead: PreparedLead, lines: LoopLine[]) => void;
  confirm: (lines: LoopLine[]) => void;
  logicOpener: (choice: "yes" | "tweak", lines: LoopLine[]) => void;
  logicResult: (choice: LogicChoice | "pass", lines: LoopLine[]) => void;
  skipSection: (lines: LoopLine[]) => void;
  /** Lines added to the chat with nothing saved (discussion over a waiting choice). */
  discuss: (lines: LoopLine[]) => void;
  jumpTo: (index: number) => void;
  promptType: (value: "lesson" | "personal_experience" | "mixed") => void;
};

type Props = {
  paperId: string;
  intro: {
    heading: string;
    body: string;
    /** What this stage is for (north star E). */
    purpose?: string;
    /** Their Stage 1 decision, referenced instead of re-asked (north star D). */
    earlier?: string | null;
    /** Key points from the material, labeled by source. */
    material?: { label: string; points: string[] }[];
  };
  promptType: "lesson" | "personal_experience" | "mixed";
  /** What "lesson" reads as for this assignment ("Argument", "Analysis" or "Lesson"). */
  lessonLabel?: string;
  sections: StanceSectionView[];
  active: number;
  kind: StanceTurnKind;
  card: TeachCard | null;
  followUpCard: TeachCard | null;
  mirrorAsk: string;
  triggers: MemoryTrigger[] | null;
  activeTrigger: string | null;
  safetyNote: string;
  /** Model search terms still on the way: show a placeholder, not keyword leads. */
  leadsPending?: boolean;
  batch: { ranked: PreparedLead[]; wildcard: PreparedLead | null; capReached: boolean; searchPrompt: string | null } | null;
  transcript: LoopLine[];
  /** Her answer to a request/question; shown inside the current turn only. */
  aside: { k: string; at: number; paras: string[]; intent?: StanceIntent } | null;
  /** The Stage 1 options again as chips after "just tell me some options" (QA 6:03 AM). */
  asideChips?: string[];
  classify: (text: string, ask: string) => Promise<StanceIntent>;
  onAside: (intent: StanceIntent, turn: IntentTurn, lines: LoopLine[], forced?: "vague") => void | Promise<void>;
  /** Pau Pau is checking (relevance) before she answers. */
  busy?: boolean;
  idea: string;
  onIdea: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop: (event: DragEvent<HTMLTextAreaElement>) => void;
  thinNote: string | null;
  noteStatus: DraftSaveStatus;
  skipped: { key: string; title: string }[];
  /** Voice note slot (PLAN.md 9: folded into her reply, never its own bubble). */
  voiceNote: string | null;
  handlers: StanceHandlers;
  /** PC-28: the paper's skeleton (labels/titles) and the student's own words for it. */
  skeleton?: { view: SkeletonView | null; words: SkeletonWords; direction?: string | null };
};

/** PC-28: the earlier conversation for the read-only "Past chat" (section headings once). */
export function pastLines(transcript: LoopLine[], sections: { key: string; title: string }[]): PastLine[] {
  let lastK: string | null = null;
  return transcript.map((l) => {
    const heading = l.k !== lastK ? (sections.find((x) => x.key === l.k)?.title ?? null) : null;
    lastK = l.k;
    return { who: l.who, text: l.text, heading };
  });
}

/** PC-28: what the welcome line names: the last locked section and the one they're on. */
export function focusFill(sections: { title: string; status: string }[], active: number): { done: string | null; next: string } {
  const done = [...sections.slice(0, active)].reverse().find((s) => s.status === "confirmed");
  return { done: done ? sectionLabel(done.title) : null, next: sectionLabel(sections[active]?.title) || "the next section" };
}

/** Said when a new reply joins their note (QA 8:31 AM: never a silent overwrite). */
export const ADDED_NOTE = "I added that to your note, and your earlier words stay too. If it should replace them instead, say \"change it to\" and the new words.";

const TAP_HINT = "Tap one of the choices in my message to keep going. Your words stay in the box.";

/**
 * "Quick lesson on <title>: <definition>" without splicing punctuation: a
 * title that ends in ?, ! or . is quoted and keeps its own mark.
 */
export function quickLessonLine(concept: string, definition: string): string {
  const c = concept.trim();
  if (/[?!.]$/.test(c)) return `Quick lesson on your question, “${c}” ${definition}`;
  return `Quick lesson on ${c}: ${definition}`;
}

/** Off-prompt claims lead with the mismatch, not a generalization critique (QA 10:38 #4). */
export function isOffPrompt(r: { basis?: string; reason?: string } | null | undefined): boolean {
  return Boolean(r && (r.basis === "off_prompt" || /^This doesn't answer the question your prompt asks/.test(r.reason ?? "")));
}

/** Pau Pau's words for the current turn: what's spoken and what the turn says. */
export function stanceTurnParas(
  kind: StanceTurnKind,
  ctx: {
    section: StanceSectionView;
    card: TeachCard | null;
    mirrorAsk: string;
    activeTrigger: string | null;
    /** Per-paper quip deal (QA 3:35 B): the paper id and this section's index. */
    seed?: string;
    index?: number;
    /** Their latest note in this section (praise matches its quality). */
    lastNote?: string;
    /** What this section is for, taught once per kind of section (north star E). */
    purpose?: string;
  },
): string[] {
  const { section, card } = ctx;
  return oneQuipParas(stanceTurnParasRaw(kind, ctx, section, card));
}

/** Praise that matches a vague note: honest, no hype (QA 11/23). */
export const VAGUE_CONFIRM = "Okay, that's a start, and you can sharpen it in your outline. Want to go with it for now?";

/** One quip per section at most: even sections on the lead pick, odd ones on the logic opener. */
export function quipSlotFor(index: number | undefined): "pick_lead" | "logic_opener" {
  return (index ?? 0) % 2 === 0 ? "pick_lead" : "logic_opener";
}

/** The probe opener: a first-section start, a short hand-off for later sections. */
export function probeLead(index: number | undefined, title: string): string {
  const part = title.toLowerCase();
  return index === undefined || index <= 0 ? `Let's start with your ${part}.` : `On to your ${part}.`;
}

/** "<lead> <quip> <ask>" from the paper's opener pool (quip optional). */
export function logicOpenerText(seed?: string, index?: number): string {
  const [lead, ask] = stockLine("logic_opener", seed, index).split("|") as [string, string];
  const q = quipSlotFor(index) === "logic_opener" ? quipFor(seed, index, "logic_opener") : null;
  return [lead, q, ask].filter(Boolean).join(" ");
}

/** The pass line for this section (rotates per paper). */
export function logicPassText(seed?: string, index?: number): string {
  return stockLine("logic_pass", seed, index);
}

function stanceTurnParasRaw(
  kind: StanceTurnKind,
  ctx: { mirrorAsk: string; activeTrigger: string | null; seed?: string; index?: number; lastNote?: string; purpose?: string },
  section: StanceSectionView,
  card: TeachCard | null,
): string[] {
  switch (kind) {
    case "teach_card":
      return card ? [dropBarePraise(card.affirm), quickLessonLine(card.concept, card.definition), card.ask].filter((p): p is string => Boolean(p)) : [];
    case "mirror":
      return [ctx.mirrorAsk];
    case "probe":
      return [
        `${probeLead(ctx.index, section.title)} ${ctx.purpose ? `${ctx.purpose} ` : ""}${stockLine(section.mode === "memory" ? "memory_probe" : "lesson_probe", ctx.seed, ctx.index)}`,
        ...(ctx.activeTrigger ? [SCRIPTED_MEMORY_FOLLOW_UP] : []),
      ];
    case "name_lead":
      return ["I couldn't tie research directions to this assignment yet. Name a source or example you want to check, in your own words."];
    case "pick_lead":
    {
      const q = quipSlotFor(ctx.index) === "pick_lead" && !(ctx.lastNote && isVagueNote(ctx.lastNote)) ? quipFor(ctx.seed, ctx.index, "pick_lead") : null;
      return [stockLine("pick_lead", ctx.seed, ctx.index).replace("{x}", section.title.toLowerCase()).replace("{q}", q ? ` ${q}` : "")];
    }
    case "confirm": {
      const link = section.concept && !/^(the )?(assigned )?concept$/i.test(section.concept) ? `Lesson link: ${lessonLinkFor(section.concept)}` : null;
      const vague = Boolean(ctx.lastNote && isVagueNote(ctx.lastNote));
      return [vague ? VAGUE_CONFIRM : stockLine(section.mode === "memory" ? "memory_confirm" : "confirm", ctx.seed, ctx.index), ...(link ? [link] : [])];
    }
    case "logic_opener":
      return [logicOpenerText(ctx.seed, ctx.index)];
    case "logic_result": {
      const r = section.logic?.result;
      if (!r) return [];
      if (r.tier === "pass") return [logicPassText(ctx.seed, ctx.index)];
      if (isOffPrompt(r)) return [`${LOGIC_ALERT_LABEL}: ${r.reason}`, "Let's make this section answer what your prompt asks."];
      // The concern is named in the same line as the flag (QA 11/23: "Here's a wrinkle." alone was hollow).
      if (r.tier === "moderate")
        return [`${stockLine("logic_moderate", ctx.seed, ctx.index)}: ${moderateConcern(r, ctx.lastNote, section.title)}`, stockLine("logic_writer", ctx.seed, ctx.index)];
      return [`${LOGIC_ALERT_LABEL}: ${LOGIC_STRONG_HEADLINE}`, LOGIC_STRONG_DETAIL, ...(r.reason ? [r.reason] : [])];
    }
    case "locked_in":
      return ["That section is locked in."];
    default:
      return ["Let's keep going on this section."];
  }
}

/** The named concern for a moderate flag; never empty. */
export function moderateConcern(r: { reason?: string; alternativeAngles?: { question: string }[] }, note?: string, title = "this section"): string {
  const reason = (r.reason ?? "").trim();
  const ask = r.alternativeAngles?.[0]?.question?.trim();
  if (reason) return /[.?!”"]$/.test(reason) ? reason : `${reason}.`;
  const part = title.toLowerCase();
  if (note && isVagueNote(note)) return `Your ${part} note is still general, so a reader can't tell what it'll prove yet. Which specific example, person or idea would show it?`;
  return ask ?? `Your ${part} could use one more specific detail. What example would show it best in your ${part}?`;
}

function Choices({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * Stage 2 (Stance) as one Pau Pau conversation (PLAN.md 9): one reply per
 * turn, one question at a time, the same composer and voice call as Stage 1.
 * The teach card, mirror, probe, lead pick, confirm and logic check are each
 * one Pau Pau turn. Gates are decided by the caller (coaching-loop) exactly as before.
 */
export function StanceChat(props: Props) {
  const {
    paperId,
    intro,
    sections,
    active,
    kind,
    card,
    followUpCard,
    transcript,
    idea,
    handlers: h,
  } = props;
  useStopSpeechOnUnmount();
  const [hintState, setHintState] = useState<{ text: string; key: string } | null>(null);
  const [checking, setChecking] = useState(false);
  // The box as it is right now (updated every render), so a reply that lands later never clobbers new typing.
  const ideaRef = useRef(idea);
  ideaRef.current = idea;
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  // One send at a time, set synchronously (state lags a tap): a second send
  // waits in the composer's queue and never doubles her reply (QA 2:08 #4).
  const inFlight = useRef(false);
  const vaguePushed = useRef(new Set<string>());
  const section = sections[active];
  // PC-28: a return with history opens a clean chat: one welcome line, then the exact turn they were on.
  const focus = useFocusReturn(paperId, true, transcript.some((l) => l.who !== "pau"), focusFill(sections, active));
  const welcomeLine = focus.line;
  const [panel, setPanel] = useState<"skeleton" | "past" | null>(null);
  // Grok Voice realtime (Stage 2 PoC, server flag): the only voice path when on.
  const rtMode = useRealtimeEnabled(paperId);
  const sendNowRef = useRef<(text: string, fromVoice?: boolean) => Promise<string>>(async () => "none");
  const screenRef = useRef("");
  const noteBusy = useRef(0);
  // A replacement waiting for "Want me to swap that in?" (section:turn, the new note).
  const swapRef = useRef<{ key: string; text: string } | null>(null);
  const mountLen = useRef(transcript.length);
  const [mountAt] = useState(transcript.length);
  const rt = useRealtimeCall({
    paperId,
    saveNote: async (text) => {
      noteBusy.current = Date.now() + 60_000;
      try {
        const result = await sendNowRef.current(text, true);
        await new Promise((r) => setTimeout(r, 80));
        return { ok: true, result, screen: screenRef.current };
      } finally {
        noteBusy.current = Date.now() + 1_500;
      }
    },
    welcome: () => ({
      welcome: Boolean(welcomeLine) && transcript.length === mountLen.current,
      index: focus.index,
      text: welcomeLine,
    }),
  });
  const rtTurnKey = section ? `${section.key}:${kind}:${transcript.length}` : "";
  const rtSeenKey = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // A new scripted turn after a tap (not a restore, not her own save_note): she says it.
  useEffect(() => {
    if (!rt.on) {
      rtSeenKey.current = null;
      return;
    }
    // What's on screen and the choices waiting for a tap, so she can point to them.
    const choices = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="group"] button') ?? [])
      .map((b) => b.textContent?.trim() ?? "")
      .filter(Boolean);
    if (rtSeenKey.current === null || rtSeenKey.current === rtTurnKey) {
      rtSeenKey.current = rtTurnKey;
      rt.setScreen(screenRef.current, choices);
      return;
    }
    rtSeenKey.current = rtTurnKey;
    if (Date.now() < noteBusy.current) {
      // Her voice note moved the app on: she points to any new choices after her reply.
      rt.setScreen(screenRef.current, choices, true);
      return;
    }
    rt.setScreen(screenRef.current, choices);
    rt.sayTurn(screenRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per turn
  }, [rtTurnKey, rt.on]);
  if (!section) return null;
  const lastNote = [...transcript].reverse().find((l) => l.who === "you" && l.k === section.key)?.text;
  const purpose = sectionPurpose(section.title);
  const purposeOnce = sections.findIndex((s) => sectionPurpose(s.title) === purpose) === active ? purpose : undefined;
  const turnParas = stanceTurnParas(kind, { section, card, mirrorAsk: props.mirrorAsk, activeTrigger: props.activeTrigger, seed: paperId, index: active, lastNote, purpose: purposeOnce });
  const logicAsk = logicOpenerText(paperId, active);
  const pau = (text: string): LoopLine => ({ k: section.key, who: "pau", text });
  const you = (text: string): LoopLine => ({ k: section.key, who: "you", text });
  // A tapped choice is app text: a "Picked: …" chip, never the student's words.
  const pick = (text: string): LoopLine => ({ k: section.key, who: "pick", text });
  const r = section.logic?.result;
  // Hints belong to this turn only; a new turn never shows an old hint.
  const turnId = `${section.key}:${kind}:${transcript.length}`;
  const hint = hintState?.key === turnId ? hintState.text : null;
  const setHint = (text: string | null) => setHintState(text ? { text, key: turnId } : null);
  // Her answer to a request/question is already in the transcript (append-only).
  // Legacy sessions may still carry it on the marker.
  const asideHere = Boolean(props.aside && props.aside.k === section.key && props.aside.at === transcript.length);
  const asideParas = asideHere ? props.aside!.paras : [];
  // After she answers, she never re-asks the opener: a short follow-up instead.
  const freeText = kind === "probe" || kind === "teach_card" || kind === "mirror";
  const paras0 = asideHere && freeText ? [asideFollowUp(props.aside?.intent, section.title)] : turnParas;
  // Idempotent turns (QA 5:44 PM): a turn already said AND answered in the
  // saved history for this section (by section id) is never said again
  // verbatim, whatever re-rendered it (a remount, a late restore, a toggle).
  const said = alreadyAnswered(transcript, section.key, paras0.join(" "));
  const paras = said ? sectionResume(transcript, section.key, section.title, freeText) : paras0;
  const ask = paras.join(" ");

  async function send() {
    const text = idea.trim();
    if (!text || checking || inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    // The box empties the moment it's sent; anything typed next is its own message.
    props.onIdea("");
    // QA 7:02 AM: "Digging it up…" at send time for anything that may need a lookup.
    // QA 8:31 AM: optimistic, same tick as send, never waiting on the server.
    setLookupNote(mayNeedLookup(text) ? "Digging it up…" : "Thinking…");
    try {
      await sendNow(text);
    } finally {
      inFlight.current = false;
      setChecking(false);
      // The note stays while her answer loads (props.busy); it's cleared on the next send.
    }
  }

  async function sendNow(text: string, fromVoice = false): Promise<string> {
    // Put the words back only if nothing new was typed (a hint, a thin note).
    // QA 5:46: never over words typed since Enter; and a later "clear" only clears what was sent.
    const restore = () => {
      if (!ideaRef.current.trim()) props.onIdea(text);
    };
    const clearSent = () => {
      const cur = ideaRef.current.trim();
      if (!cur || cur === text.trim()) props.onIdea("");
    };
    setHint(null);
    // A clear spoken yes ("Yes, lock it in") is the same as typing yes: same handler, same gate.
    const yes = isPlainYes(text) || (fromVoice && isSpokenYes(text));
    const choiceTurn = kind === "confirm" || kind === "logic_opener" || kind === "logic_result" || kind === "locked_in" || kind === "none";
    // Over a waiting choice (Colton 11:45 PM): new ideas are discussion; a clear
    // replacement is saved only after "Want me to swap that in?" gets a yes.
    // Typed and spoken words take the same path (same gate).
    const noteTurn = choiceTurn && kind !== "none" && kind !== "locked_in";
    const swapKey = `${section.key}:${kind}`;
    const pending = swapRef.current?.key === swapKey ? swapRef.current : null;
    if (noteTurn && pending) {
      swapRef.current = null;
      if (isSwapYes(text) || (fromVoice && isSpokenYes(text))) {
        clearSent();
        await h.probeSave(fromVoice ? [pau(SWAP_ASK), you(text)] : [you(text)], { replace: true, text: pending.text });
        return "saved";
      }
      if (isSwapNo(text)) {
        clearSent();
        if (!fromVoice) h.discuss([you(text), pau("Okay, your note stays as it is.")]);
        return "swap_declined";
      }
    }
    const replacement = noteTurn ? replacementText(text) : null;
    if (replacement) {
      swapRef.current = { key: swapKey, text: replacement };
      clearSent();
      if (!fromVoice) h.discuss([you(text), pau(SWAP_ASK)]);
      return "swap_ask";
    }
    if (choiceTurn && yes) {
      // handled below
    } else {
      // Content, or something said TO Pau Pau? Requests are never saved as notes.
      const intent = await props.classify(text, ask);
      if (intent !== "content") {
        // On a Grok Voice call she answers it out loud; it is still never saved as a note.
        if (fromVoice) return "aside";
        const turn: IntentTurn = choiceTurn ? "choice" : kind === "teach_card" || kind === "mirror" || kind === "probe" || kind === "name_lead" || kind === "pick_lead" ? kind : "probe";
        props.onAside(intent, turn, [pau(ask), you(text)]);
        return "aside";
      }
    }
    // A vague note gets one honest push toward specifics per section, not hollow praise (QA 11/23).
    if ((kind === "teach_card" || kind === "mirror" || kind === "probe") && !(choiceTurn && yes) && isVagueNote(text) && !vaguePushed.current.has(section.key)) {
      vaguePushed.current.add(section.key);
      if (fromVoice) return "aside";
      clearSent();
      props.onAside("content", kind === "teach_card" || kind === "mirror" ? kind : "probe", [pau(ask), you(text)], "vague");
      return "aside";
    }
    switch (kind) {
      case "teach_card":
        // Typed words are their reply (never a "Something else" chip): saved as the note.
        await h.probeSave([pau(card?.ask ?? ask), you(text)], { fromTeach: true, text });
        return "saved";
      case "mirror":
        await h.mirrorSave([pau(ask), you(text)], text);
        return "saved";
      case "probe":
        await h.probeSave([pau(paras[0] ?? ""), you(text)], { text });
        return "saved";
      case "name_lead":
      case "pick_lead":
        h.nameLead(text, [pau(paras[0] ?? ""), you(text)]);
        return "saved";
      case "confirm":
        if (yes) {
          clearSent();
          h.confirm([pau(paras[0] ?? ""), you(text)]);
          return "saved";
        }
        break;
      case "logic_opener":
        if (yes) {
          clearSent();
          h.logicOpener("yes", [pau(logicAsk), you(text)]);
          return "saved";
        }
        break;
      case "logic_result":
        if (r?.tier === "pass" && yes) {
          clearSent();
          h.logicResult("pass", [pau(logicPassText(paperId, active)), you(text)]);
          return "saved";
        }
        break;
    }
    // QA 7:11 AM: a new, substantive answer over the confirm is added to their note, never
    // turned away ("Your note is still the one above…"). Replacing still asks first.
    if ((kind === "confirm" || kind === "logic_opener") && substantiveNote(text) && !isVagueNote(text)) {
      clearSent();
      await h.probeSave([pau(kind === "confirm" ? paras[0] ?? "" : logicAsk), you(text), pau(ADDED_NOTE)], { text, append: true });
      return "saved";
    }
    // Other words over a choice are discussion: the saved note never changes.
    if (noteTurn) {
      clearSent();
      if (!fromVoice) h.discuss([you(text), pau(discussionLine(transcript.length))]);
      return "discussion";
    }
    // Spoken words after a lock-in never land in the box as a stale note, and no
    // tap hint covers the next turn: on a call she points to the choices herself.
    if (fromVoice) return "tap_needed";
    restore();
    setHint(TAP_HINT);
    return "tap_needed";
  }
  // eslint-disable-next-line react-hooks/refs -- latest send for her save_note tool
  sendNowRef.current = sendNow;

  const placeholder =
    kind === "mirror"
      ? "What it means to you, in your words"
      : kind === "probe"
        ? "Your idea, in your words"
        : kind === "name_lead"
          ? "A source, person, or example to verify"
          : kind === "pick_lead"
            ? "Or name your own source or example"
            : kind === "teach_card"
              ? "Or tell me in your own words"
              : "Reply to Pau Pau, or tap a choice";

  // The opener: question, "one section at a time", edit link, prompt type and
  // section chips. It is the top of Pau Pau's FIRST reply, never its own bubble.
  const introControls = (
    <div key="intro-controls" className="space-y-3">
          {intro.material?.length ? (
            <details className="text-[14px] leading-[1.6]" data-material-summary>
              <summary className="ds-focus cursor-pointer font-semibold">Key points from the material</summary>
              {intro.material.map((m) => (
                <div key={m.label} className="mt-2">
                  <p className="text-[13px] text-ds-muted">{m.label}</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {m.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          ) : null}
          <p className="text-[13px] leading-[1.6] text-ds-muted">
            <a href={`/app/papers/${paperId}/stage/1`} className={dsLink}>
              Edit assignment
            </a>
          </p>
          <label className={`block ${dsCaption}`}>
            Prompt type
            <select
              className={`mt-1 max-w-[240px] ${dsSelect}`}
              value={props.promptType}
              onChange={(event) => h.promptType(event.target.value as Props["promptType"])}
            >
              <option value="lesson">{props.lessonLabel ?? "Lesson"}</option>
              <option value="personal_experience">Personal experience</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
          <nav aria-label="Sections">
            <ol className="flex flex-wrap gap-2">
              {sections.map((item, index) => (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-current={index === active ? "step" : undefined}
                    className={`ds-focus min-h-[48px] rounded-full border px-3 text-[13px] font-semibold ${
                      index === active ? "border-ds-accent text-ds-accent" : "border-ds-border text-ds-muted"
                    }`}
                    onClick={() => h.jumpTo(index)}
                  >
                    {item.title}
                    {item.status === "confirmed" ? " ✓" : item.status === "skipped" ? " · Skipped" : ""}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
    </div>
  );
  const introBubbles: ReactNode[] = [
    `${intro.heading}.`.replace(/([?.!])\.$/, "$1"),
    intro.body,
    ...(intro.purpose ? [intro.purpose] : []),
    ...(intro.earlier ? [intro.earlier] : []),
    introControls,
  ];

  // History as replies: consecutive Pau Pau lines in one section are one reply;
  // a tapped choice is a "Picked" chip; only typed words are student bubbles.
  type Group = { k: string; who: LoopLine["who"]; texts: string[]; start: number };
  const allGroups: Group[] = [];
  transcript.forEach((line, i) => {
    const last = allGroups[allGroups.length - 1];
    if (last && line.who === "pau" && last.who === "pau" && last.k === line.k) last.texts.push(line.text);
    else allGroups.push({ k: line.k, who: line.who, texts: [line.text], start: i });
  });
  // Pau Pau lines at the very end belong to the current reply.
  const trailing = allGroups.length && allGroups[allGroups.length - 1]!.who === "pau" && allGroups[allGroups.length - 1]!.k === section.key ? allGroups.pop()!.texts : [];
  const introInCurrent = allGroups.length === 0 && !focus.focused;
  // PC-28 one idea at a time: only this section's turns, and on a return only what's said since.
  // Locked sections and earlier turns live in the skeleton and "Past chat", never above the prompt.
  const focusFrom = focus.focused ? mountAt : 0;
  const groups = allGroups.filter((g) => g.k === section.key && g.start >= focusFrom);
  const currentBubbles: ReactNode[] = [...(introInCurrent ? introBubbles : []), ...trailing, ...asideParas, ...paras];
  // eslint-disable-next-line react-hooks/refs -- latest screen text for her tools
  screenRef.current = [...trailing, ...asideParas, ...paras].join(" ");
  const speak: SpeakItem[] = rtMode ? [] : [
    { key: "s2:intro", text: `${intro.heading}. ${intro.body}`, opener: !transcript.some((l) => l.who !== "pau") },
    { key: `s2:${section.key}:${kind}:${transcript.length}`, text: [...trailing, ...asideParas, ...paras].join(" "), turn: true },
  ];
  const showIntro = allGroups.length > 0 && allGroups[0]!.k === section.key && groups[0]?.start === 0 && !focus.focused;
  const history = groups.map((group, i) => {
    const head = i === 0 ? sections.find((item) => item.key === group.k)?.title : null;
    const first = i === 0 && group.who === "pau" && showIntro;
    return (
      <div key={i} className="space-y-4">
        {head && !(i === 0 && !first) ? <p className={`text-center ${dsCaption}`}>{head}</p> : null}
        {i === 0 && !first && showIntro ? <PauPauGroup showName bubbles={introBubbles} /> : null}
        {i === 0 && !first && showIntro && head ? <p className={`text-center ${dsCaption}`}>{head}</p> : null}
        {group.who === "pau" ? (
          <PauPauGroup showName={first} bubbles={first ? [...introBubbles, ...group.texts] : group.texts} />
        ) : group.who === "pick" ? (
          <PickedChip label={group.texts[0]!} fullText={group.texts[0]!} />
        ) : (
          <StudentBubble message={{ text: group.texts[0]!, files: [], at: 0 }} />
        )}
      </div>
    );
  });

  return (
    <div ref={rootRef} className="mx-auto max-w-[680px] font-ds-sans text-ds-ink" data-stage-chat="2">
      <SpeakNew scope={`${paperId}:stage2`} items={speak} />
      <ChatHeader eyebrow="Stage 2 · Stance" eyebrowClassName={dsEyebrow} hideVoice={rtMode} />
      <FocusBar
        onSkeleton={() => setPanel("skeleton")}
        onPast={() => setPanel("past")}
        hasPast={transcript.length > 0}
        menu={introInCurrent || showIntro ? undefined : introControls}
      />
      {panel === "skeleton" ? (
        <SkeletonPanel view={props.skeleton?.view ?? null} words={props.skeleton?.words ?? {}} direction={props.skeleton?.direction} onClose={() => setPanel(null)} />
      ) : null}
      {panel === "past" ? <PastChatPanel lines={pastLines(transcript, sections)} onClose={() => setPanel(null)} /> : null}
      <div className="mt-4 space-y-4" role="log" aria-label="Conversation with Pau Pau">
        {/* PC-28: the return's one opener comes first, then the exact turn they were on. */}
        <FocusOpener line={welcomeLine} scope={`${paperId}:stage2`} signal={`${transcript.length}:${kind}:${active}`} silent={rtMode} onProgress={() => setPanel("skeleton")} />
        {history}

        {/* Pau Pau's current turn: ONE reply. */}
        <PauPauGroup
          showName={introInCurrent}
          bubbles={currentBubbles}
          headingIndex={Math.max(0, currentBubbles.length - 1)}
          headingId="stance-question"
          live
        >
          <p className={dsCaption} data-section-step>
            Section {active + 1} of {sections.length} · {section.title}: {section.needs}
          </p>

          {asideHere && props.asideChips?.length ? (
            <Choices label="Options from earlier">
              {props.asideChips.map((chip) => (
                <DsButton key={chip} type="button" size="sm" variant="secondary" data-option-chip onClick={() => props.onIdea(`I'd go with ${chip} because `)}>
                  {chip}
                </DsButton>
              ))}
            </Choices>
          ) : null}

          {kind === "teach_card" && card ? (
            <>
              <Choices label="Pick one">
                {card.qualities.map((quality) => (
                  <DsButton key={quality} type="button" size="sm" variant="secondary" onClick={() => h.teachAspect(quality, [pau(card.ask), pick(quality)])}>
                    {quality}
                  </DsButton>
                ))}
                <DsButton type="button" size="sm" variant="secondary" onClick={() => h.teachAspect(SOMETHING_ELSE, [pau(card.ask), pick(SOMETHING_ELSE)])}>
                  {SOMETHING_ELSE}
                </DsButton>
                <DsButton type="button" size="sm" variant="ghost" onClick={() => h.teachSkip([pau(card.ask), pick(KNOW_THIS_ONE)])}>
                  {KNOW_THIS_ONE}
                </DsButton>
              </Choices>
              <ul className="list-disc space-y-1 pl-5 text-[16px] text-ds-muted">
                {card.showsUpAs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="text-[13px] leading-[1.6] text-ds-muted">{TEACH_FOOTER}</p>
            </>
          ) : null}

          {kind === "probe" && followUpCard ? (
            <div className="space-y-2 border-t border-ds-border pt-3" data-teach-then-ask>
              {followUpCard.affirm ? <p>{followUpCard.affirm}</p> : null}
              <p>{followUpCard.definition}</p>
              <p>{followUpCard.ask}</p>
              <Choices label="Pick one">
                {followUpCard.qualities.map((quality) => (
                  <DsButton key={quality} type="button" size="sm" variant="secondary" onClick={() => h.followUpAspect(quality)}>
                    {quality}
                  </DsButton>
                ))}
                <DsButton type="button" size="sm" variant="secondary" onClick={() => h.followUpAspect(SOMETHING_ELSE)}>
                  {SOMETHING_ELSE}
                </DsButton>
                <DsButton type="button" size="sm" variant="ghost" onClick={h.followUpSkip}>
                  {KNOW_THIS_ONE}
                </DsButton>
              </Choices>
            </div>
          ) : null}

          {kind === "probe" && props.triggers ? (
            <div className="space-y-2 border-t border-ds-border pt-3">
              <p className="text-ds-muted">{MEMORY_TRIGGER_INTRO}</p>
              <ul className="space-y-2">
                {props.triggers.map((trigger) => (
                  <li key={trigger.id} className="space-y-1">
                    <p className="font-semibold">{trigger.label}</p>
                    <Choices label={trigger.label}>
                      <DsButton type="button" size="sm" variant="secondary" onClick={() => h.triggerPick(trigger)}>
                        Show this idea
                      </DsButton>
                      <DsButton type="button" size="sm" variant="ghost" onClick={() => h.triggerHide(trigger)}>
                        Not this one
                      </DsButton>
                    </Choices>
                  </li>
                ))}
              </ul>
              {props.activeTrigger ? <p>{props.activeTrigger}</p> : null}
              <DsButton type="button" size="sm" variant="ghost" onClick={h.triggersSkip}>
                Skip these
              </DsButton>
            </div>
          ) : null}
          {kind === "probe" && props.safetyNote ? <p className="border-t border-ds-border pt-3">{props.safetyNote}</p> : null}

          {kind === "pick_lead" && props.batch && props.leadsPending ? (
            <p className="flex min-h-[48px] items-center gap-2 text-[13px] leading-[1.6] text-ds-muted" role="status" data-search-pending>
              <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-ds-border border-t-ds-accent motion-safe:animate-spin" />
              Finding search ideas…
            </p>
          ) : kind === "pick_lead" && props.batch ? (
            <ul className="space-y-3" aria-label="Directions to check" data-lead-batch>
              {props.batch.ranked.map((lead) => (
                <li key={lead.name} className="rounded-[8px] border border-ds-border bg-ds-page p-3 text-[16px]">
                  <p className="font-semibold">
                    {lead.rank === 1 ? <span className="mr-2 text-[13px] uppercase text-ds-accent">Best fit</span> : null}
                    {lead.name}
                    {" "}<span className="ml-2 text-[13px] font-semibold uppercase text-ds-muted">Check it yourself</span>
                  </p>
                  <p className="text-ds-muted">{lead.whyFits}</p>
                  <DsButton type="button" size="sm" variant="secondary" className="mt-1" onClick={() => h.pickLead(lead, [pau(paras[0] ?? ""), pick(lead.name)])}>
                    Try this direction
                  </DsButton>
                </li>
              ))}
              {props.batch.wildcard ? (
                <li className="rounded-[8px] border border-dashed border-ds-border p-3 text-[16px]">
                  <p className="text-ds-muted">The ones above are usually cited. Here&apos;s one outside the box that shows the same pattern.</p>
                  <p className="font-semibold">{props.batch.wildcard.name}</p>
                  <p className="text-ds-muted">{props.batch.wildcard.wildcardWhy}</p>
                  {props.batch.wildcard.controversyNote ? <p className="text-ds-muted">{props.batch.wildcard.controversyNote}</p> : null}
                  <DsButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mt-1"
                    onClick={() => h.pickLead(props.batch!.wildcard!, [pau(paras[0] ?? ""), pick(props.batch!.wildcard!.name)])}
                  >
                    Try this stretch
                  </DsButton>
                </li>
              ) : null}
              {props.batch.capReached && props.batch.searchPrompt ? (
                <li className="text-[16px]">
                  <p className="font-semibold">Search it yourself</p>
                  <p className="text-ds-muted">{props.batch.searchPrompt}</p>
                </li>
              ) : null}
            </ul>
          ) : null}

          {kind === "confirm" ? (
            <>
              {section.mode !== "memory" ? (
                <dl className="space-y-1 text-[16px] leading-[1.6]">
                  <div>
                    <dt className="inline font-semibold">Lead: </dt>
                    <dd className="inline">{section.chosenLead ?? "your lead"}</dd>
                  </div>
                  {(() => {
                    const angle = [section.teachAspect, section.concept].find((item) => item && !/^(the )?(assigned )?concept$/i.test(item)) ?? null;
                    return angle ? (
                      <div>
                        <dt className="inline font-semibold">Angle: </dt>
                        <dd className="inline">{asHeading(angle)}</dd>
                      </div>
                    ) : null;
                  })()}
                </dl>
              ) : null}
              <Choices label="Lock it in">
                <DsButton type="button" size="sm" onClick={() => h.confirm([pau(paras[0] ?? ""), pick("Yes, lock it in")])}>
                  Yes, lock it in
                </DsButton>
              </Choices>
            </>
          ) : null}

          {kind === "logic_opener" ? (
            <Choices label="Logic check">
              <DsButton type="button" size="sm" disabled={props.busy} aria-busy={props.busy || undefined} onClick={() => h.logicOpener("yes", [pau(logicAsk), pick(LOGIC_YES)])}>
                {LOGIC_YES}
              </DsButton>
              <DsButton type="button" size="sm" variant="secondary" onClick={() => h.logicOpener("tweak", [pau(logicAsk), pick(LOGIC_TWEAK)])}>
                {LOGIC_TWEAK}
              </DsButton>
            </Choices>
          ) : null}

          {kind === "logic_result" && r ? (
            <div
              data-logic-tier={r.tier}
              className={r.tier === "strong" ? "space-y-2 border-l-4 border-ds-error pl-3" : r.tier === "moderate" ? "space-y-2 border-l-4 border-ds-amber pl-3" : "space-y-2"}
              {...(r.tier !== "pass" ? { role: "region", "aria-label": LOGIC_ALERT_LABEL } : {})}
            >
              {/* QA 8:31 AM: the alert is visibly flagged (Design System amber for a soft flag, error red for a strong one). */}
              {r.tier !== "pass" ? (
                <p
                  data-logic-flag={r.tier}
                  className={`inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider ${r.tier === "strong" ? "text-ds-error" : "text-ds-ink"}`}
                >
                  <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${r.tier === "strong" ? "bg-ds-error" : "bg-ds-amber"}`} />
                  {r.tier === "strong" ? LOGIC_ALERT_LABEL : "Worth a second look"}
                </p>
              ) : null}
              {r.tier === "strong" && r.studentClaimRef?.quote ? <p className="text-ds-muted">Your claim: “{r.studentClaimRef.quote}”</p> : null}
              {r.tier === "strong" && r.citedTerm?.quote ? <p className="text-ds-muted">Your assignment asks: “{r.citedTerm.quote}”</p> : null}
              {r.tier !== "pass" && r.alternativeAngles.length ? (
                <ul className="list-disc space-y-1 pl-5">
                  {r.alternativeAngles.map((a) => (
                    <li key={a.question}>{a.question}</li>
                  ))}
                </ul>
              ) : null}
              <Choices label="What next">
                {r.tier === "pass" ? (
                  <DsButton type="button" size="sm" onClick={() => h.logicResult("pass", [pau(logicPassText(paperId, active)), pick("Continue")])}>
                    Continue
                  </DsButton>
                ) : r.tier === "moderate" ? (
                  <>
                    <DsButton type="button" size="sm" onClick={() => h.logicResult("keep", [pau(paras.join(" ")), pick("Keep my angle")])}>
                      Keep my angle
                    </DsButton>
                    <DsButton type="button" size="sm" variant="secondary" onClick={() => h.logicResult("adjust", [pau(paras.join(" ")), pick("Adjust it")])}>
                      Adjust it
                    </DsButton>
                  </>
                ) : (
                  <>
                    <DsButton type="button" size="sm" variant="secondary" onClick={() => h.logicResult("new_angle", [pau(paras.join(" ")), pick("Pick a new angle")])}>
                      Pick a new angle
                    </DsButton>
                    <DsButton type="button" size="sm" variant="secondary" onClick={() => h.logicResult("revise", [pau(paras.join(" ")), pick("Revise my claim")])}>
                      Revise my claim
                    </DsButton>
                    <DsButton type="button" size="sm" variant="secondary" onClick={() => h.logicResult("reframe", [pau(paras.join(" ")), pick("Reframe it")])}>
                      Reframe it
                    </DsButton>
                    <DsButton type="button" size="sm" onClick={() => h.logicResult("continued", [pau(paras.join(" ")), pick(LOGIC_CONTINUE)])}>
                      {LOGIC_CONTINUE}
                    </DsButton>
                  </>
                )}
              </Choices>
            </div>
          ) : null}

          {props.thinNote ? (
            <p className="border-t border-ds-border pt-3" role="status" data-thin-note>
              {props.thinNote}
            </p>
          ) : null}
          {hint ? (
            <p className="text-[13px] leading-[1.6] text-ds-muted" role="status">
              {hint}
            </p>
          ) : null}
          {props.voiceNote ? <p className="border-t border-ds-border pt-3 text-ds-muted" data-voice-note="reply">{props.voiceNote}</p> : null}
          {props.skipped.length ? (
            <div className="space-y-1 border-t border-ds-border pt-3 text-[16px]">
              {props.skipped.map((item) => (
                <p key={item.key}>
                  You skipped {item.title}. It needs to be finished before you start your draft.{" "}
                  <button
                    type="button"
                    className={`ds-focus min-h-[48px] ${dsLink}`}
                    onClick={() => h.jumpTo(sections.findIndex((s) => s.key === item.key))}
                  >
                    Go back to {item.title}
                  </button>
                </p>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1">
            <ReplayButton texts={[ask]} className="-ml-2" />
            {section.status !== "confirmed" ? (
              <button
                type="button"
                className="ds-focus min-h-[48px] px-2 text-[13px] text-ds-muted underline-offset-4 hover:underline"
                onClick={() => h.skipSection([pick("Skip this section for now")])}
              >
                Skip this section for now
              </button>
            ) : null}
          </div>
        </PauPauGroup>
        {rtMode ? <LiveTurns rows={rt.live} /> : null}
        <ScrollToNewest signal={`${transcript.length}:${kind}:${active}:${props.thinNote ?? ""}:${hint ?? ""}:${rt.live.length}`} />
        <IntentWarm idea={isPlainYes(idea) ? "" : idea} ask={ask} classify={props.classify} />
        {lookupNote && (checking || props.busy) ? (
          <p className="text-[13px] leading-[1.6] text-ds-muted" role="status" aria-live="polite" data-lookup-status>
            {lookupNote}
          </p>
        ) : null}
      </div>

      <ComposerDock>
        <ChatComposer
          paperId={paperId}
          labelledBy="stance-question"
          value={idea}
          onChange={(next) => {
            setHint(null);
            props.onIdea(next);
          }}
          onPaste={props.onPaste}
          inputProps={{ onDrop: props.onDrop }}
          minRows={1}
          placeholder={placeholder}
          sending={checking || Boolean(props.busy)}
          onSend={() => void send()}
          realtimeSlot={rtMode ? <RealtimeControls call={rt} /> : undefined}
        />
        <SaveStatus status={props.noteStatus} />
      </ComposerDock>
    </div>
  );
}

/**
 * Pau Pau's rotating stock lines (QA 4:42 #2): every line she says once per
 * section (the probe ask, the leads intro, the confirm, the logic-check opener,
 * the pass line, the "your call" line) comes from a per-paper pool. Section i
 * gets pool[(offset + i) % n], so no stock line repeats verbatim inside one
 * paper (up to n sections). The offset is stable per paper and slot, so a
 * reload says the same thing. Without a seed she uses the first line.
 */

export const STOCK_POOLS = {
  /** Probe ask (lesson path). The first section always gets the canonical line. */
  lesson_probe: [
    LESSON_PROBE_OPENER,
    "Know where this part's headed? Or want me to ask a few questions and get the research going?",
    "Got a direction for this one? Or should I start asking questions until one shows up?",
    "Any thoughts on this part yet? Or should I start poking with questions?",
    "Got a plan here? Or want me to grill you a little first? Nicely.",
    "Already know what goes here? Or want a few questions to point you at some research?",
    "Got a hunch for this part? Trust it, or let me ask a few questions first.",
    "Know what you want to say here? Or want me to ask until something clicks?",
  ],
  /** Probe ask (memory path). */
  memory_probe: [
    MEMORY_PROBE_OPENER,
    "Any moment from your life that fits here? Or want a few questions to shake one loose?",
    "Got a memory for this one? Or should I play detective with a few questions?",
    "Is there a moment that fits here already? Or want help digging one up?",
    "Thinking of a moment for this part? Or want a few questions to jog it?",
    "Something from your own life fit here? Or want me to ask around first?",
    "Got a story for this section? Or want some questions to help you find one?",
    "Any moment come to mind for this part? Or should I nudge you with a few questions?",
  ],
  /** Leads intro; {x} is the section title, {q} the optional quip. */
  pick_lead: [
    "Okay, a few directions worth checking for your {x}, built off your note.{q} Pick one to try, or tell me your own.",
    "Here's where I'd dig for your {x}, based on your note.{q} Pick one, or overrule me.",
    "Got a few leads for your {x}, straight from your note.{q} Grab one, or point me somewhere better.",
    "Your note gave me some places to dig for your {x}.{q} Take one, or pitch your own.",
    "A few paths for your {x}, built from what you wrote.{q} Choose one, or name a different one.",
    "Okay, leads for your {x} that actually fit your note.{q} Pick one to chase, or tell me yours.",
    "Your note points a few ways for your {x}.{q} Want one of these? Or name your own.",
    "Some starting points for your {x}, pulled from your note.{q} Take one, or tell me what you'd rather check.",
  ],
  /** Confirm after a lesson-path pick. */
  confirm: [
    // QA 7:11 AM: no hollow praise on a pick (it fired on a question-only lead).
    "Ready to roll with it?",
    "Want to lock this one in?",
    "Lock it in, or keep working on it?",
    "Ready to run with it?",
    "Going with it?",
    "Want to go with it?",
    "Ready to move on with this?",
    "Keep it?",
  ],
  /** Confirm after a memory-path pick. */
  memory_confirm: [
    MEMORY_CONFIRM,
    "Go with this moment?",
    "Want to use this moment?",
    "Run with this story?",
    "Keep this one as your example?",
    "Want to stick with this moment?",
    "Use this one?",
    "Lock this moment in?",
  ],
  /** Logic-check opener: [lead, ask]; a quip may sit between them. */
  logic_opener: [
    "Quick logic check.|You feel good about this?",
    "Let's pressure-test it.|Does it hold up for you?",
    "Before we lock it, a fast logic pass.|Happy with it?",
    "Time for a quick gut check.|You good with it?",
    "One more look before it's locked.|Still feel right?",
    "Let's poke at the logic real quick.|Feel solid?",
    "Fast logic pass before we move on.|Confident in this one?",
    "Let's make sure it holds together.|Feel good about it?",
  ],
  /** Logic check passed. */
  logic_pass: [
    LOGIC_PASS,
    // QA 7:11 AM: a pass says what was checked, never bare praise.
    "Logic check ✓ It stays on the prompt and doesn't contradict your thesis.",
    "Logic check ✓ I didn't find a contradiction with your thesis or inside the note.",
    "Logic check ✓ It answers the prompt, and the reason backs the claim.",
    "Logic check ✓ Your claim and its reason point the same way.",
    "Logic check ✓ No contradiction with your earlier sections.",
    "Logic check ✓ It's on the prompt and consistent with your thesis.",
    "Logic check ✓ The point and its support line up.",
  ],
  /** Moderate flag title (no end mark; the turn adds "."). */
  logic_moderate: [
    LOGIC_MODERATE_TITLE,
    "Okay, real talk before you keep going",
    "One thing worth a second look",
    "Small thing before you move on",
    "Quick thought on this one",
    "Worth a look before you lock it",
    "Here's a wrinkle",
    "One thing that caught my eye",
  ],
  /** After a moderate flag: the choice is the student's. */
  logic_writer: [
    LOGIC_WRITER,
    "Totally up to you. It's your paper.",
    "You decide. You know this paper better than I do.",
    "Your paper, your call.",
    "Up to you. I just have opinions.",
    "Keep it or change it. Either way, it's your call.",
    "You've got the final say here.",
    "Your words, your rules.",
  ],
} as const;

export type StockSlot = keyof typeof STOCK_POOLS;

/** Slots whose first section always gets the canonical first line. */
const FIXED_START: ReadonlySet<StockSlot> = new Set(["lesson_probe", "memory_probe"]);

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** The stock line for one slot in one section of one paper. */
export function stockLine(slot: StockSlot, seed?: string, index?: number): string {
  const pool = STOCK_POOLS[slot] as readonly string[];
  if (!seed || index === undefined || index < 0) return pool[0]!;
  const offset = FIXED_START.has(slot) ? 0 : hash(`${seed}:${slot}`) % pool.length;
  return pool[(offset + index) % pool.length]!;
}

/** Was this exact turn already said for this section and answered after? */
export function alreadyAnswered(transcript: LoopLine[], key: string, text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  for (let i = transcript.length - 1; i >= 0; i--) {
    const line = transcript[i]!;
    if (line.k !== key || line.who !== "pau") continue;
    if (line.text.replace(/\s+/g, " ").trim() !== t) continue;
    return transcript.slice(i + 1).some((l) => l.k === key && l.who !== "pau");
  }
  return false;
}

/** Her short line instead of a repeat. */
export function resumeLine(title: string, freeText: boolean): string {
  return freeText
    ? `Back to your ${title.toLowerCase()}. Pick up in the box whenever you're ready.`
    : `Back to your ${title.toLowerCase()}. Your call is below.`;
}

/** A resume line already used in this section is silence, never another canned repeat. */
export function sectionResume(transcript: LoopLine[], key: string, title: string, freeText: boolean): string[] {
  const line = resumeLine(title, freeText);
  const mark = (s: string) => s.replace(/\s+/g, " ").trim();
  return transcript.some((l) => l.k === key && l.who === "pau" && mark(l.text) === mark(line)) ? [] : [line];
}

