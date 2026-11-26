/**
 * PC-31 (Colton t213u #3): browser side of Pau's live "thinking" line. Posts to the coach route with
 * stream: true, shows each real step the server sends ("Searching for …", "Reading strategypunk.com…",
 * "Pulling it together…"), and fills gaps with short rotating lines so she never looks frozen.
 */
import { STATUS_ROTATION, statusPhase, type StatusKind } from "@/lib/coach/thinking-status";

export type PauAnswer = { paras?: string[]; sources?: { title: string; url: string }[]; spoken?: { text: string; sig: string } | null; mode?: string; effort?: string; gated?: boolean };

export function statusKindFor(mode: string): StatusKind {
  return mode === "research" ? "research" : mode === "summary" ? "summary" : /reading|answer|lost/.test(mode) ? "reading" : "think";
}

/** Split an NDJSON chunk stream into whole lines (keeps the partial tail). */
export function ndjsonLines(buf: string): { lines: unknown[]; rest: string } {
  const parts = buf.split("\n");
  const rest = parts.pop() ?? "";
  const lines: unknown[] = [];
  for (const p of parts) {
    if (!p.trim()) continue;
    try {
      lines.push(JSON.parse(p));
    } catch {
      /* skip a bad line */
    }
  }
  return { lines, rest };
}

/**
 * Fetch one Pau answer with live status. `idleMs`: give up when nothing (status or answer) arrives for this
 * long; `maxMs`: hard cap. Returns null on failure (callers fall back).
 */
export async function fetchPauAnswer(
  url: string,
  body: Record<string, unknown>,
  o: { onStatus?: (line: string) => void; kind?: StatusKind; idleMs?: number; maxMs?: number; rotateMs?: number } = {},
): Promise<PauAnswer | null> {
  const controller = new AbortController();
  const maxTimer = setTimeout(() => controller.abort(), o.maxMs ?? 55_000);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const bump = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), o.idleMs ?? 22_000);
  };
  // Rotating fill-in lines between real steps (never repeats one, never goes back to the first).
  const rotation = STATUS_ROTATION[o.kind ?? "think"];
  let lastAt = Date.now();
  let rot = 0;
  const shown = new Set<string>();
  let phase = 0;
  // QA 5:32: each line stays up long enough to read (~0.7s), so "Searching for …" isn't replaced by
  // "Reading …" in the same instant. Queued lines are dropped when the answer arrives.
  const MIN_SHOW_MS = 700;
  let shownAt = 0;
  const queue: string[] = [];
  let pump: ReturnType<typeof setTimeout> | null = null;
  let displayed = "";
  const flush = () => {
    pump = null;
    const next = queue.shift();
    if (!next) return;
    displayed = next;
    shownAt = Date.now();
    o.onStatus?.(next);
    if (queue.length) pump = setTimeout(flush, MIN_SHOW_MS);
  };
  const show = (line: string) => {
    // QA 5:32: searching → reading → writing, never back to an earlier step.
    const ph = statusPhase(line);
    if (ph && ph < phase) return;
    if (line === (queue.at(-1) ?? displayed)) return;
    if (ph) phase = ph;
    lastAt = Date.now();
    shown.add(line);
    queue.push(line);
    if (!pump) {
      const wait = Math.max(0, shownAt + MIN_SHOW_MS - Date.now());
      if (wait === 0) flush();
      else pump = setTimeout(flush, wait);
    }
  };
  // QA 6:35 #4: the writing line ("Pulling it together…") is always the last status a research turn shows,
  // even when it arrived just before the answer (queued lines are otherwise dropped). It stays up briefly.
  const landOnWriting = async <T,>(m: T): Promise<T> => {
    const w = queue.find((l) => statusPhase(l) === 3);
    if (w && displayed !== w) {
      if (pump) clearTimeout(pump);
      pump = null;
      queue.length = 0;
      displayed = w;
      o.onStatus?.(w);
      await new Promise((r) => setTimeout(r, 400));
    }
    return m;
  };
  const rotTimer = setInterval(() => {
    if (Date.now() - lastAt < (o.rotateMs ?? 4_000)) return;
    while (rot < rotation.length - 1 && shown.has(rotation[rot + 1]!)) rot++;
    if (rot < rotation.length - 1) show(rotation[++rot]!);
  }, 1_000);
  try {
    bump();
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, stream: true }), signal: controller.signal });
    if (!res.ok || !res.body) return null;
    if (!/ndjson/.test(res.headers.get("content-type") ?? "")) return ((await res.json().catch(() => null)) as PauAnswer | null) ?? null;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bump();
      buf += dec.decode(value, { stream: true });
      const { lines, rest } = ndjsonLines(buf);
      buf = rest;
      for (const l of lines) {
        const m = l as { type?: string; text?: string } & PauAnswer;
        if (m.type === "status" && typeof m.text === "string") {
          const i = rotation.indexOf(m.text);
          if (i > rot) rot = i;
          show(m.text);
        } else if (m.type === "done") return await landOnWriting(m);
      }
    }
    const tail = ndjsonLines(`${buf}\n`).lines.find((l) => (l as { type?: string }).type === "done") as PauAnswer | undefined;
    return tail ? await landOnWriting(tail) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(maxTimer);
    if (idleTimer) clearTimeout(idleTimer);
    clearInterval(rotTimer);
    if (pump) clearTimeout(pump);
    queue.length = 0;
  }
}
