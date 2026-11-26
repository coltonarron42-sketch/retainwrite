"use client";

import { friendlyStatus } from "@/lib/stage1/reading-status";
import { namedWorksFrom } from "@/lib/stage1/readings";
import { inlineLabel } from "@/lib/stage1/reading-label";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DsButton } from "@/components/ui/ds-button";
import { fetchWithTimeout } from "@/lib/net/fetch-timeout";
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
import { decisionQuestion, looksLikePastedReading, pastedReadingParas, mayNeedLookup, parseStance, summaryParas, withoutDarkWeb, type MaterialSummary, type ReadbackPlain } from "@/lib/stage1/paper-context";
import {
  COACH_NAME,
  PAU_PAU_ASK_TEXT,
  askWasMade,
  sourcesAskText,
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
  /** The assignment sheet text, so Pau can answer questions about it. */
  sheetText?: string;
  /** The welcome-back line on a return (rendered after her latest turn). */
  welcome?: ReactNode;
  /** PC-28: on a return, Pau's one opener, shown first. */
  opener?: ReactNode;
  /** PC-28: turns before this index were on screen before the return: hidden (her latest turn always shows). */
  hideBefore?: number;
  /** Grok Voice: spoken replies go through the same path as typed ones. */
  sendRef?: { current: ((text: string) => Promise<void>) | null };
  /** Grok Voice controls in the composer, and this call's live turns. */
  realtimeSlot?: ReactNode;
  live?: ReactNode;
  /** On a Grok Voice call she speaks through the call only (no old text-to-speech). */
  oldVoiceOff?: boolean;
  /** The paper context after a save here (a stated stance, the material shown), so the chat after the confirm is current. */
  onBrief?: (view: Record<string, unknown>) => void;
  /** The material catch-up with its buttons (QA 9:37 AM), shown under the reply that taught it. */
  materialSlot?: ReactNode;
};

export { PauPauAvatar };

/** Asks the student already declined or answered, from the saved conversation. */
export function dismissedFromTurns(turns: ConfirmTurn[]): Set<PauPauAsk> {
  const out = new Set<PauPauAsk>();
  for (const t of turns) if (t.role === "pau" && t.skip) out.add(t.skip);
  return out;
}

/**
 * After the read: Pau says back what it understood in ONE reply and the
 * student answers in the same chat box (PLAN.md 9). "Looks good" confirms;
 * a question gets an answer; a correction updates the card and Pau
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
  opener,
  hideBefore = 0,
  sendRef,
  realtimeSlot,
  live,
  oldVoiceOff = false,
  onBrief,
  materialSlot,
}: Props) {
  const materialShownRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyStatus, setReplyStatus] = useState("Thinking…");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const turnsRef = useRef(turns);
  const reqRef = useRef(requirements);
  /** The material lookup, started the moment a message may need it (QA 7:02 AM latency). */
  const summaryEarly = useRef<Promise<unknown> | null>(null);
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
  const ask = pauPauNextAsk(requirements, dismissed, sheetText ?? "");

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
    onTurns([{ role: "pau", paras: readBackParas(requirements, { pendingAsk: ask, seed: paperId, plain, sheetText }) }]);
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

  /** Asks Pau already made once: she doesn't repeat them every turn (the topic is the exception). */
  function askedBefore(): Set<PauPauAsk> {
    const said = turnsRef.current.flatMap((t) => (t.role === "pau" ? t.paras : [])).join(" ");
    const out = new Set<PauPauAsk>();
    for (const key of ["sources", "length"] as const) if (askWasMade(said, key)) out.add(key);
    return out;
  }

  /** The next missing thing Pau hasn't asked yet, or null. */
  function nextNewAsk(req: AssignmentRequirements, after: Set<PauPauAsk>): PauPauAsk | null {
    const next = pauPauNextAsk(req, new Set([...after, ...askedBefore()]), sheetText ?? "");
    return next;
  }

  /** What to ask after this reply: the next missing thing, else "does it look right?". */
  function followUp(after: Set<PauPauAsk>): string {
    const next = nextNewAsk(reqRef.current, after);
    if (next === "sources") return sourcesAskText(namedWorksFrom(reqRef.current, sheetText ?? ""));
    return next ? PAU_PAU_ASK_TEXT[next] : "Anything else, or does the rest look right?";
  }

  // QA 9:37 AM: one send at a time, even for two taps in the same tick (idempotent).
  const sendLock = useRef(false);
  async function sendReply(spoken?: string) {
    if (sendLock.current) return;
    sendLock.current = true;
    try {
      await sendReplyNow(spoken);
    } finally {
      sendLock.current = false;
    }
  }

  async function sendReplyNow(spoken?: string) {
    const text = (spoken ?? draft).replace(/\s+$/, "");
    if (!text.trim() || replying || confirming) return;
    if (spoken === undefined) setDraft("");
    // The ask Pau is actually waiting on: only if her last reply ended with it
    // (sources/length are asked once; after that she's asking "does it look right?").
    const lastPau = [...turnsRef.current].reverse().find((t) => t.role === "pau");
    const liveAsk: PauPauAsk | null =
      ask === "topic" || (ask && lastPau?.role === "pau" && askWasMade(lastPau.paras.at(-1) ?? "", ask)) ? ask : null;
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
    // A long paste here is material (QA 8:31 AM walk B): saved and summarized, never parsed as a pick.
    if (looksLikePastedReading(text)) {
      setReplyStatus("Reading it now…");
      try {
        const v = (await briefPost({ action: "reading", title: "Pasted reading", text: text.slice(0, 200_000) })) as { summaries?: MaterialSummary[]; summary?: MaterialSummary | null } | null;
        const s0 = v?.summaries?.find((x) => x.title === "Pasted reading") ?? [...(v?.summaries ?? [])].reverse().find((x) => x.kind === "reading") ?? null;
        if (s0) void briefPost({ action: "material_shown" });
        push({
          role: "pau",
          paras: pastedReadingParas({ title: "Pasted reading", summary: s0, text, tail: "What do you make of it, in your own words? And tell me if the rest of the read-back looks right." }),
        });
      } finally {
        setReplying(false);
        setReplyStatus("Thinking…");
      }
      return;
    }
    // QA 7:02 AM: "Digging it up…" shows at send time, and the lookup starts now, in parallel
    // with the classify call, instead of ~8 s later.
    if (mayNeedLookup(text)) {
      setReplyStatus("Digging it up…");
      summaryEarly.current ??= briefPost({ action: "summary" });
    }
    // A stance said here ("I want to argue transformational, using Satya Nadella") is saved now,
    // so the chat after the confirm never re-asks it.
    const stance = /\?\s*$/.test(text) ? null : parseStance(text);
    if (stance && /\b(argue|arguing|thesis|my (?:stance|argument|angle)|write about|focus on|go(?:ing)? with)\b/i.test(stance.stance)) {
      const leader = stance.leader;
      void briefPost({ action: "decision", question: "Said before the read-back was confirmed", answer: stance.stance, source: "stated" }).then(() =>
        leader ? briefPost({ action: "decision", question: "stated", answer: stance.stance, slot: "leader", named: leader }) : null,
      );
    }
    try {
      // A link while Pau is asking for sources: check it and keep it.
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

      // A stalled reply falls back to the same rules the server uses (QA 9:37 AM: 45 s with no reply).
      const res = await fetchWithTimeout(`/api/papers/${paperId}/assignment/reply`, {
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
      }, 15_000);
      // Offline, stalled, or the server failed: the same rules the server falls back to.
      const result = ((res?.ok ? await res.json().catch(() => null) : null) as ConfirmResult | null) ?? rulesClassify(text, liveAsk);

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
        // QA 6:03 AM: answered in place, never deflected.
        materialShownRef.current = false;
        const extra = result.route ? await answerInPlace(result.route, text) : [];
        const material = materialShownRef.current;
        materialShownRef.current = false;
        // No "here's the gist" lead-in when all she has is an honest ask (QA 6:03 AM handout walk).
        const noGist = result.route === "material" && !material && !extra.some((x) => /^Here's what I know|^I found|key points|general overview|general background|^•/.test(x));
        const lead = noGist && /\b(gist|here'?s|here it is|key points)\b/i.test(result.reply) ? "" : result.reply;
        push({ role: "pau", paras: [lead, ...extra, ...(material ? [] : [followUp(after)])].filter(Boolean), skip, ...(material ? { material: true } : {}) });
        if (material) push({ role: "pau", paras: [followUp(after)] });
        return;
      }
      // Ambiguous: a real clarifying question, never move on.
      push({ role: "pau", paras: [result.reply?.trim() || clarifyingAsk(liveAsk)], skip });
    } catch {
      push({ role: "pau", paras: [clarifyingAsk(liveAsk)] });
    } finally {
      setReplying(false);
      setReplyStatus("Thinking…");
    }
  }

  /** The catch-up, the options, or the assignment in plain words, right here before the confirm. */
  function briefPost(body: Record<string, unknown>): Promise<unknown> {
    return fetchWithTimeout(`/api/papers/${paperId}/intake/brief`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, 25_000)
      .then((r) => (r?.ok ? r.json() : null))
      .then((v: unknown) => {
        if (v && typeof v === "object" && "northstar" in v) onBrief?.(v as Record<string, unknown>);
        return v;
      })
      .catch(() => null);
  }

  async function answerInPlace(route: "material" | "options" | "explain", said = ""): Promise<string[]> {
    if (route === "explain") {
      const p = plain ?? null;
      if (!p?.ask) return [];
      return [
        `In plain words: ${p.ask}`,
        p.mustInclude.length ? `To do well, it needs ${p.mustInclude.map(inlineLabel).join(", ")}.` : "",
      ].filter(Boolean);
    }
    setReplyStatus(route === "material" ? "Digging it up… (I'm checking what I know about your readings)" : "Pulling together a few real options…");
    type View = { summary?: MaterialSummary | null; summaries?: MaterialSummary[]; missingAsk?: string | null; whereToGet?: { title: string; offers: { seller: string; url: string; price?: string | null }[] }[]; options?: { question: string; options: { label: string; why: string }[] } | null };
    const call = async (action: string): Promise<View | null> =>
      fetch(`/api/papers/${paperId}/intake/brief`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
        .then((r) => (r.ok ? (r.json() as Promise<View>) : null))
        .catch(() => null);
    try {
      if (route === "options") {
        const v = await call("options");
        if (!v?.options?.options.length) return ["Once you confirm the read-back, I'll ask which one you'd argue. I only list options I can see in your materials, so I won't guess at the chapter's."];
        return [decisionQuestion(v.options), "You'll lock one in right after we confirm the read-back."];
      }
      // The early lookup (started at send) when there is one; she shows it, so the chat never re-asks "have you read it?".
      const early = summaryEarly.current;
      summaryEarly.current = null;
      const v = ((early ? await early : null) as View | null) ?? (await briefPost({ action: "summary" }) as View | null);
      if (!v) return ["I couldn't pull the key points together just now. Ask me again in a sec, and I'll pick it right back up."];
      const list0 = v?.summaries?.length ? v.summaries : v?.summary ? [v.summary] : [];
      // The reading they asked about first ("what is Goleman saying?"), then the rest.
      const asked = said.toLowerCase();
      const hits = (x: MaterialSummary) => x.title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && asked.includes(w)).length;
      const list = [...list0].sort((a, b) => hits(b) - hits(a));
      const paras = list.flatMap((x) => summaryParas(x));
      if (paras.length) void briefPost({ action: "material_shown" });
      // The catch-up renders as the material panel, buttons included (QA 9:37 AM).
      if (paras.length && materialSlot !== undefined) {
        materialShownRef.current = true;
        return [];
      }
      const offers = (v?.whereToGet ?? []).flatMap((w) => w.offers.map((o) => `${w.title} at ${o.seller}${o.price ? ` · ${o.price} (price from search; check the page)` : ""}: ${o.url}`));
      return [...paras, ...(v?.missingAsk ? [withoutDarkWeb(v.missingAsk)] : []), ...offers].slice(0, 28);
    } finally {
      setReplyStatus("Thinking…");
    }
  }

  async function uploadSource(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    // Title from the file's own first line; the student's file name otherwise.
    const read = await extractFileText(paperId, file).catch(() => null);
    const firstLine = read && read.ok ? read.text.split(/\n/).map((l) => l.trim()).find((l) => l.length >= 6) : null;
    // The reading's text is what Pau summarizes when they haven't read it (north star B).
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
  const lastMaterial = turns.reduce((last, t, i) => (t.role === "pau" && t.material ? i : last), -1);
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
      {opener}
      {turns.map((t, i) =>
        i < hideBefore && i !== lastPau ? null : t.role === "student" ? (
          <StudentBubble key={i} message={{ text: t.text, files: [], at: 0 }} />
        ) : (
          <Fragment key={i}>
          <PauPauGroup bubbles={t.paras} live={i === lastPau && i > 0}>
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
                {ask !== "topic" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <DsButton type="button" size="sm" variant="primary" disabled={replying || confirming} onClick={() => onConfirm()}>
                      {confirming ? "Saving…" : "Looks right, let's start"}
                    </DsButton>
                  </div>
                ) : null}
                <ReplayButton className="-ml-2" texts={lastParas} />
              </>
            ) : null}
          </PauPauGroup>
          {i === lastMaterial && materialSlot ? <div data-confirm-material>{materialSlot}</div> : null}
          </Fragment>
        ),
      )}
      {replying ? (
        <div className="flex items-start gap-2 sm:gap-3" role="status">
          <PauPauAvatar />
          <p className="mt-1 pt-1 text-[16px] leading-[1.6] text-ds-muted">
            {friendlyStatus(replyStatus)}
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
          placeholder={ask === "topic" ? "What's the paper about?" : "Reply to Pau… “looks good” or what to change"}
        />
      </ComposerDock>
    </>
  );
}
