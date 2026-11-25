/**
 * PC-31 (Colton t213u #4): readings the student hasn't uploaded. Pau looks for the reading itself online
 * (publisher, author, university, open access) and never uses pirated copies.
 */
import { sourceHost } from "@/lib/coach/sources-line";

/** File-sharing and document-dump hosts: never cited, never used. */
export const BLOCKED_SOURCE_HOSTS = [
  "libgen", "library genesis", "z-lib", "zlibrary", "z-library", "singlelogin", "1lib", "b-ok", "pdfdrive", "pdfroom", "dokumen.pub", "vdoc.pub", "ebin.pub", "epdf.pub", "epdf.tips",
  "pdfcoffee", "doku.pub", "idoc.pub", "studylib", "scribd", "coursehero", "studocu", "quizlet", "chegg", "slideshare", "pdfslide", "fliphtml5", "yumpu", "issuu", "annas-archive", "sci-hub", "freebookspot", "ebookee", "anyflip",
];

export function isBlockedSource(url: string): boolean {
  const host = sourceHost(url).toLowerCase();
  if (!host) return true;
  return BLOCKED_SOURCE_HOSTS.some((b) => host.includes(b.replace(/\s+/g, "")));
}

/** Drops blocked sources and any bullet that cites a blocked host by name. */
export function dropBlocked<T extends { url: string }>(sources: T[], paras: string[]): { sources: T[]; paras: string[]; dropped: number } {
  const kept = sources.filter((s) => !isBlockedSource(s.url));
  const re = new RegExp(`\\b(?:${BLOCKED_SOURCE_HOSTS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*")).join("|")})\\b`, "i");
  const ps = paras.filter((p) => !re.test(p));
  return { sources: kept, paras: ps, dropped: sources.length - kept.length + (paras.length - ps.length) };
}

export const UPLOAD_INVITE = "Your own scan or PDF works best: upload it and I'll work from your exact pages.";

/** The reading reply always invites their copy (once), just before the closing question. */
export function withUploadInvite(paras: string[]): string[] {
  if (paras.some((p) => /\b(upload|scan|pdf|photos?|paste the pages)\b/i.test(p))) return paras;
  const lastQ = paras.length && /\?\s*$/.test(paras[paras.length - 1]!) ? paras.length - 1 : paras.length;
  return [...paras.slice(0, lastQ), UPLOAD_INVITE, ...paras.slice(lastQ)];
}

/** Readings named in the paper (titles/authors) whose text we don't have. */
export function unreadReadingNames(ctx: {
  readings?: { title: string; text: string }[];
  missing?: string[];
  whereToGet?: { title: string }[];
  mustInclude?: string[];
  block: string;
}): { titles: string[]; tokens: string[] } {
  const cap = (t: string) => t.match(/\b[A-Z][a-zA-Z'’-]{3,}\b/g) ?? [];
  const have = new Set((ctx.readings ?? []).filter((r) => r.text?.trim()).flatMap((r) => cap(r.title)));
  const titles = [
    ...(ctx.missing ?? []),
    ...(ctx.whereToGet ?? []).map((w) => w.title),
    ...(ctx.mustInclude ?? []).filter((x) => /chapter|reading|textbook|article|book|\(/i.test(x)),
    ...ctx.block.split("\n").filter((l) => /chapter|reading|textbook|article|\bbook\b/i.test(l)).map((l) => l.slice(0, 300)),
    ...(ctx.readings ?? []).filter((r) => !r.text?.trim()).map((r) => r.title),
  ].filter((t) => cap(t).some((w) => !have.has(w)));
  return { titles: [...new Set(titles)].slice(0, 8), tokens: [...new Set(titles.flatMap(cap).filter((w) => !have.has(w)))] };
}
