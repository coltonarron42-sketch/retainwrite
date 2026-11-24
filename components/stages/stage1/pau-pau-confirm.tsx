"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DsButton } from "@/components/ui/ds-button";
import { extractFileText } from "@/lib/assignment/client-extract";
import { markFieldConfirmed } from "@/lib/assignment/confirm";
import { dsCaption } from "@/lib/ds/classes";
import {
  ComposerDock,
  PauPauAvatar,
  PauPauGroup,
  ScrollToNewest,
  StudentBubble,
} from "@/components/stages/stage1/chat-bubbles";
import { ChatComposer } from "@/components/stages/stage1/chat-composer";
import { ReplayButton, SpeakNew } from "@/components/stages/stage1/voice";
import type { AssignmentRequirements, ProvidedReading } from "@/lib/assignment/schema";
import type { ReadbackPlain } from "@/lib/stage1/paper-context";
import {
  COACH_NAME,
  PAU_PAU_ASK_TEXT,
  pauPauNextAsk,
  readBackParas,
  reconfirmParas,
  type PauPauAsk,
} from "@/lib/stage1/pau-pau";
import {
  appendStudentNote,
  applyConfirmUpdates,
  isQuickConfirm,
  linkIn,
  type ConfirmResult,
  type ConfirmTurn,
  clarifyingAsk,
  rulesClassify,
} from "@/lib/stage1/confirm-reply";

type Props = {
  paperId: string;
  requirements: AssignmentRequirements;
  onChange: (next: AssignmentRequirements) => void;
  /** Saves the confirmed card and moves on to the questions. */
  onConfirm: () => void;
  onStartOver: () => void;
  confirming: boolean;
  error: string | null;
  /** The conversation about the read-back, saved so a reload shows the same thing. */
  turns: ConfirmTurn[];
  onTurns: (next: ConfirmTurn[]) => void;
  /** The assignment sheet text, so Pau Pau can answer questions about it. */
  sheetText?: string;
  /** The welcome-back line on a return (rendered after her latest turn). */
  welcome?: ReactNode;
  /** Grok Voice: spoken replies go through the same path as typed ones. */
  sendRef?: { current: ((text: string) => Promise<void>) | null };
  /** Grok Voice controls in the composer, and this call's live turns. */
  realtimeSlot?: ReactNode;
  live?: ReactNode;
  /** On a Grok Voice call she speaks through the call only (no old text-to-speech). */
  oldVoiceOff?: boolean;
};

export { PauPauAvatar };

/** Asks the student already declined or answered, from the saved conversation. */
export function dismissedFromTurns(turns: ConfirmTurn[]): Set<PauPauAsk> {
  const out = new Set<PauPauAsk>();
  for (const t of turns) if (t.role === "pau" && t.skip) out.add(t.skip);
  return out;
}

/**
 * After the read: Pau Pau says back what it understood in ONE reply and the
 * student answers in the same chat box (PLAN.md 9). "Looks good" confirms;
 * a question gets an answer; a correction updates the card and Pau Pau
 * re-confirms. Nothing moves on from an unclear reply.
 */
export function PauPauConfirm({
  paperId,
  requirements,
  onChange,
  onConfirm,
  onStartOver,
  confirming,
  error,
  turns,
  onTurns,
  sheetText,
  welcome,
  sendRef,
  realtimeSlot,
  live,
  oldVoiceOff = false,
}: Props) {
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const turnsRef = useRef(turns);
  const reqRef = useRef(requirements);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);
  useEffect(() => {
    reqRef.current = requirements;
  }, [requirements]);

  useEffect(() => {
    if (!sendRef) return;
    sendRef.current = (text: string) => sendReply(text);
    return () => {
      sendRef.current = null;
    };
  });

  const dismissed = useMemo(() => dismissedFromTurns(turns), [turns]);
  const ask = pauPauNextAsk(requirements, dismissed);

  // North star (Colton t161u): the plain-words read-back (what's asked, what a strong
  // answer needs, how it's graded). Waits a few seconds for it; the sheet facts otherwise.
  const [plain, setPlain] = useState<ReadbackPlain | null | undefined>(turns.length ? null : undefined);
  useEffect(() => {
    if (turns.length || plain !== undefined) return;
    let done = false;
    const finish = (v: ReadbackPlain | null) => {
      if (done) return;
      done = true;
      setPlain(v);
    };
    const timer = window.setTimeout(() => finish(null), 9_000);
    void fetch(`/api/papers/${paperId}/intake/brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "readback" }),
    })
      .then(async (res) => (res.ok ? ((await res.json()) as { readback?: ReadbackPlain | null }) : null))
      .then((data) => finish(data?.readback ?? null))
      .catch(() => finish(null))
      .finally(() => window.clearTimeout(timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The first reply: the read-back, saved as the start of the conversation.
  useEffect(() => {
    if (turns.length || plain === undefined) return;
    onTurns([{ role: "pau", paras: readBackParas(requirements, { pendingAsk: ask, seed: paperId, plain }) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length, plain]);

  function push(...more: ConfirmTurn[]) {
    const next = [...turnsRef.current, ...more];
    turnsRef.current = next;
    onTurns(next);
  }

  function addReading(reading: ProvidedReading) {
    const req = reqRef.current;
    const list = [...(req.providedReadings.value ?? []), reading];
    const field = markFieldConfirmed(req.providedReadings, { value: list });
    const next = { ...req, providedReadings: field, providedSources: field };
    reqRef.current = next;
    onChange(next);
    // Keep it on the saved assignment so a reload doesn't ask again.
    void fetch(`/api/papers/${paperId}/assignment/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", readings: list }),
    }).catch(() => undefined);
  }

  /** Asks Pau Pau already made once: she doesn't repeat them every turn (the topic is the exception). */
  function askedBefore(): Set<PauPauAsk> {
    const said = turnsRef.current.flatMap((t) => (t.role === "pau" ? t.paras : [])).join(" ");
    const out = new Set<PauPauAsk>();
    for (const key of ["sources", "length"] as const) if (said.includes(PAU_PAU_ASK_TEXT[key])) out.add(key);
    return out;
  }

  /** The next missing thing Pau Pau hasn't asked yet, or null. */
  function nextNewAsk(req: AssignmentRequirements, after: Set<PauPauAsk>): PauPauAsk | null {
    const next = pauPauNextAsk(req, new Set([...after, ...askedBefore()]));
    return next;
  }

  /** What to ask after this reply: the next missing thing, else "does it look right?". */
  function followUp(after: Set<PauPauAsk>): string {
    const next = nextNewAsk(reqRef.current, after);
    return next ? PAU_PAU_ASK_TEXT[next] : "Anything else, or does the rest look right?";
  }

  async function sendReply(spoken?: string) {
    const text = (spoken ?? draft).replace(/\s+$/, "");
    if (!text.trim() || replying || confirming) return;
    if (spoken === undefined) setDraft("");
    // The ask Pau Pau is actually waiting on: only if her last reply ended with it
    // (sources/length are asked once; after that she's asking "does it look right?").
    const lastPau = [...turnsRef.current].reverse().find((t) => t.role === "pau");
    const liveAsk: PauPauAsk | null =
      ask === "topic" || (ask && lastPau?.role === "pau" && (lastPau.paras.at(-1) ?? "").includes(PAU_PAU_ASK_TEXT[ask])) ? ask : null;
    push({ role: "student", text });
    const currentAsk = ask;

    // Plain "looks good": straight on, unless the topic is still missing (gate).
    if (isQuickConfirm(text)) {
      if (currentAsk === "topic") {
        push({ role: "pau", paras: ["Before we start I need the topic.", PAU_PAU_ASK_TEXT.topic] });
        return;
      }
      onConfirm();
      return;
    }

    setReplying(true);
    try {
      // A link while Pau Pau is asking for sources: check it and keep it.
      const url = currentAsk === "sources" ? linkIn(text) : null;
      if (url) {
        const check = (await fetch(`/api/papers/${paperId}/assignment/readings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check", url }),
        })
          .then((res) => res.json())
          .catch(() => null)) as { ok?: boolean; reason?: string } | null;
        if (!check?.ok) {
          push({
            role: "pau",
            paras: [
              check?.reason === "not_found"
                ? "I couldn't open that link: the page says it doesn't exist. Double-check it, or upload the PDF instead."
                : "I couldn't open that link. Double-check it, or upload the PDF instead.",
            ],
          });
          return;
        }
        addReading({ url, origin: "manual" });
        const after = new Set(dismissed).add("sources");
        push({ role: "pau", paras: ["Nice, I've got that source.", followUp(after)], skip: "sources" });
        return;
      }

      const res = await fetch(`/api/papers/${paperId}/assignment/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.slice(0, 2000),
          pendingAsk: liveAsk,
          requirements: reqRef.current,
          sheetExcerpt: sheetText?.slice(0, 8000) || undefined,
          history: turnsRef.current.slice(-8).map((t) =>
            t.role === "student" ? { role: "student", text: t.text.slice(0, 2000) } : { role: "pau", paras: t.paras.slice(0, 12) },
          ),
        }),
      });
      // Offline or the server failed: the same rules the server falls back to.
      const result = ((res.ok ? await res.json().catch(() => null) : null) as ConfirmResult | null) ?? rulesClassify(text, liveAsk);

      const skip = result.skipAsk && currentAsk ? currentAsk : undefined;
      const after = skip ? new Set(dismissed).add(skip) : dismissed;
      if (result.intent === "confirm") {
        if (pauPauNextAsk(reqRef.current, after) === "topic") {
          push({ role: "pau", paras: ["Before we start I need the topic.", PAU_PAU_ASK_TEXT.topic], skip });
          return;
        }
        if (skip) push({ role: "pau", paras: [result.reply], skip });
        onConfirm();
        return;
      }
      if (result.intent === "correction") {
        const next = applyConfirmUpdates(reqRef.current, result.updates);
        reqRef.current = next;
        onChange(next);
        push({
          role: "pau",
          paras: [result.reply, ...reconfirmParas(next, nextNewAsk(next, after))],
          apply: { updates: result.updates },
          skip,
        });
        return;
      }
      if (result.intent === "extra_info") {
        if (result.keepAsNote) {
          const next = appendStudentNote(reqRef.current, text);
          reqRef.current = next;
          onChange(next);
        }
        push({
          role: "pau",
          paras: [result.reply, followUp(after)],
          apply: result.keepAsNote ? { note: text } : undefined,
          skip,
        });
        return;
      }
      if (result.intent === "question") {
        push({ role: "pau", paras: [result.reply, followUp(after)], skip });
        return;
      }
      // Ambiguous: a real clarifying question, never move on.
      push({ role: "pau", paras: [result.reply?.trim() || clarifyingAsk(liveAsk)], skip });
    } catch {
      push({ role: "pau", paras: [clarifyingAsk(liveAsk)] });
    } finally {
      setReplying(false);
    }
  }

  async function uploadSource(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    // Title from the file's own first line; the student's file name otherwise.
    const read = await extractFileText(paperId, file).catch(() => null);
    const firstLine = read && read.ok ? read.text.split(/\n/).map((l) => l.trim()).find((l) => l.length >= 6) : null;
    // The reading's text is what Pau Pau summarizes when they haven't read it (north star B).
    if (read && read.ok && read.text.trim()) {
      void fetch(`/api/papers/${paperId}/intake/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reading", title: (firstLine ?? file.name).slice(0, 120), text: read.text.slice(0, 200_000) }),
      }).catch(() => undefined);
    }
    addReading({
      title: (firstLine && firstLine.length <= 140 ? firstLine : file.name).slice(0, 300),
      notes: `Uploaded file: ${file.name}`,
      origin: "manual",
    });
    setBusy(false);
    const after = new Set(dismissed).add("sources");
    push({ role: "pau", paras: [`Nice, I've got ${file.name}.`, followUp(after)], skip: "sources" });
  }

  const lastPau = turns.reduce((last, t, i) => (t.role === "pau" ? i : last), -1);
  const speak = turns.flatMap((t, i) =>
    t.role === "pau" ? [{ key: `confirm:${i}`, text: t.paras.join(" "), turn: i === lastPau }] : [],
  );
  const lastParas = lastPau >= 0 ? (turns[lastPau] as { paras: string[] }).paras : [];

  return (
    <>
      <h1 className="sr-only">{COACH_NAME} read your assignment</h1>
      <SpeakNew scope={paperId} items={oldVoiceOff ? [] : speak} />
      {!turns.length ? (
        <p className="text-[16px] leading-[1.6] text-ds-muted" role="status" aria-live="polite">
          Reading it over…
        </p>
      ) : null}
      {turns.map((t, i) =>
        t.role === "student" ? (
          <StudentBubble key={i} message={{ text: t.text, files: [], at: 0 }} />
        ) : (
          <PauPauGroup key={i} bubbles={t.paras} live={i === lastPau && i > 0}>
            {i === lastPau ? (
              <>
                {ask === "sources" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <DsButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => fileInput.current?.click()}
                    >
                      {busy ? "Reading the file…" : "Upload a source PDF"}
                    </DsButton>
                    <input
                      ref={fileInput}
                      type="file"
                      className="hidden"
                      aria-label="Upload a source PDF"
                      accept=".pdf,.docx,.txt,.md,.html,application/pdf"
                      onChange={(e) => {
                        void uploadSource(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </div>
                ) : null}
                <ReplayButton className="-ml-2" texts={lastParas} />
              </>
            ) : null}
          </PauPauGroup>
        ),
      )}
      {replying ? (
        <div className="flex items-start gap-2 sm:gap-3" role="status">
          <PauPauAvatar />
          <p className="mt-1 pt-1 text-[16px] leading-[1.6] text-ds-muted">
            Thinking…
          </p>
        </div>
      ) : null}
      {error ? (
        <p id="confirm-error" className="text-[16px] leading-[1.6] text-ds-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className={dsCaption}>
        Wrong file?{" "}
        <button type="button" className="font-semibold text-ds-ink underline underline-offset-4" onClick={onStartOver}>
          Upload a different one
        </button>
      </p>
      {welcome}
      {live}
      <ScrollToNewest signal={`${turns.length}:${replying}`} />
      <ComposerDock>
        <span id="confirm-reply-label" className="sr-only">
          Reply to {COACH_NAME}
        </span>
        <ChatComposer
          paperId={paperId}
          labelledBy="confirm-reply-label"
          value={draft}
          onChange={setDraft}
          onSend={() => void sendReply()}
          realtimeSlot={realtimeSlot}
          sending={replying || confirming}
          minRows={1}
          placeholder={ask === "topic" ? "What's the paper about?" : "Reply to Pau Pau… “looks good” or what to change"}
        />
      </ComposerDock>
    </>
  );
}
