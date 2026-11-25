"use client";

/**
 * Browser-side text extraction for Stage 1 uploads.
 * // SOP: coaching only, never generate submission text
 *
 * - Text files: read directly.
 * - PDF: pdf.js text layer; pages with no text (scans) are rendered to JPEG
 *   and read by the server's vision OCR.
 * - Word (.docx): unzip word/document.xml and keep paragraph text.
 * - Photos: decoded, downscaled and re-encoded as JPEG (drops EXIF, keeps the
 *   request small), then read by the server's vision OCR.
 *
 * The file type comes from the file's own bytes, not its name or browser MIME.
 */

import { mergeTileTexts } from "@/lib/assignment/tile-merge";
import { looksBlank } from "@/lib/assignment/blank-image";
import {
  KIND_LABEL,
  kindFromMime,
  kindFromName,
  rejectedTypeMessage,
  type FileKind,
} from "@/lib/assignment/file-types";
import { sniffMime } from "@/lib/assignment/mime-sniff";

export { KIND_LABEL, type FileKind };

export type ClientExtractResult =
  | {
      ok: true;
      kind: FileKind;
      text: string;
      method: "txt" | "pdf_text" | "docx" | "ocr_grok_vision";
      /** Pages files: their embedded preview was read. */
      note?: string;
      /** Re-encoded JPEG for photos (EXIF dropped), used for the storage copy. */
      uploadBlob?: Blob;
    }
  | { ok: false; kind: FileKind; error: string };

const MAX_OCR_PAGES = 4;
const MAX_IMAGE_EDGE = 1600;
/** Keep each image well under the 4.5 MB request limit (4 pages per request). */
const MAX_IMAGE_BYTES = 700_000;
/** Fewer words than this per page means the PDF page is probably a scan. */
const SCANNED_PAGE_WORDS = 12;

/** Bytes first; the name and browser type only break ties (zip, text). */
export async function detectFileKind(file: File): Promise<FileKind> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const sniffed = sniffMime(head);
  const byName = kindFromName(file.name);
  const byMime = kindFromMime(file.type || "");
  if (sniffed === "application/pdf") return "pdf";
  if (sniffed?.startsWith("image/")) return "photo";
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return "legacy_word";
  const ascii = new TextDecoder("latin1").decode(head.slice(0, 8));
  if (ascii.startsWith("{\\rtf")) return "rtf";
  if (head[0] === 0x50 && head[1] === 0x4b) {
    // Zip container: .docx, .odt and .pages all look alike from the outside.
    if (byName === "odt" || byName === "pages" || byName === "word") return byName;
    if (byMime === "odt" || byMime === "pages") return byMime;
    return "word";
  }
  if (byName === "photo" || byMime === "photo") return "photo"; // HEIC/HEIF
  if (byName === "html" || byMime === "html") return "html";
  if (byName === "text" || byMime === "text" || sniffed?.startsWith("text/")) {
    // A text file that is really a saved web page.
    const start = new TextDecoder().decode(head).trimStart().toLowerCase();
    return start.startsWith("<!doctype html") || start.startsWith("<html") ? "html" : "text";
  }
  return "unknown";
}

function words(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

async function readText(file: File): Promise<string> {
  let text = await file.text();
  if (text.includes("\uFFFD")) text = new TextDecoder("latin1").decode(await file.arrayBuffer());
  return text;
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

async function unzipEntries(file: File, wanted: (name: string) => boolean) {
  const { unzipSync } = await import("fflate");
  return unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => wanted(entry.name) });
}

async function readDocx(file: File): Promise<string> {
  const { strFromU8 } = await import("fflate");
  const files = await unzipEntries(file, (name) => name === "word/document.xml");
  const xml = files["word/document.xml"];
  if (!xml) return "";
  return decodeXmlEntities(
    strFromU8(xml)
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readOdt(file: File): Promise<string> {
  const { strFromU8 } = await import("fflate");
  const files = await unzipEntries(file, (name) => name === "content.xml");
  const xml = files["content.xml"];
  if (!xml) return "";
  return decodeXmlEntities(
    strFromU8(xml)
      .replace(/<text:tab\/>/g, "\t")
      .replace(/<text:s(?: text:c="(\d+)")?\/>/g, (_, n?: string) => " ".repeat(Number(n ?? 1)))
      .replace(/<text:line-break\/>/g, "\n")
      .replace(/<\/text:(?:p|h)>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain text from RTF: drop groups like fonts/colors, keep \\par as newlines. */
export function rtfToText(rtf: string): string {
  let out = "";
  let depth = 0;
  const skipDepth: number[] = [];
  let i = 0;
  const skipping = () => skipDepth.length > 0;
  while (i < rtf.length) {
    const ch = rtf[i]!;
    if (ch === "{") {
      depth++;
      // Destination groups we never want: {\\* ...}, font/color/style tables, pictures.
      const ahead = rtf.slice(i + 1, i + 24);
      if (!skipping() && /^\\\*|^\\(?:fonttbl|colortbl|stylesheet|info|pict|header|footer|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|themedata|datastore|latentstyles)/.test(ahead)) {
        skipDepth.push(depth);
      }
      i++;
      continue;
    }
    if (ch === "}") {
      if (skipDepth.at(-1) === depth) skipDepth.pop();
      depth--;
      i++;
      continue;
    }
    if (ch === "\\") {
      const next = rtf[i + 1] ?? "";
      if (next === "\\" || next === "{" || next === "}") {
        if (!skipping()) out += next;
        i += 2;
        continue;
      }
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (!skipping()) out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
        continue;
      }
      const word = rtf.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (word) {
        const name = word[1]!;
        if (!skipping()) {
          if (name === "par" || name === "line" || name === "row") out += "\n";
          else if (name === "tab" || name === "cell") out += "\t";
          else if (name === "u" && word[2]) {
            const code = Number(word[2]);
            out += String.fromCharCode(code < 0 ? code + 65536 : code);
            // skip the ANSI fallback character that follows \\uN
            i += 1 + word[0].length;
            if (rtf[i] === "?") i++;
            continue;
          }
        }
        i += 1 + word[0].length;
        continue;
      }
      i += 2;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      i++;
      continue;
    }
    if (!skipping()) out += ch;
    i++;
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, template, svg, nav, footer").forEach((el) => el.remove());
  doc.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  doc
    .querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, tr, section, article, header, blockquote, pre")
    .forEach((el) => el.append("\n"));
  return (doc.body?.textContent ?? "").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

/**
 * Old binary Word (.doc): best effort. The text sits in the WordDocument
 * stream as 8-bit or UTF-16 runs; pull readable runs and keep real lines.
 */
export function readLegacyDoc(bytes: Uint8Array): string {
  const runs8: string[] = [];
  let run = "";
  for (const b of bytes) {
    if ((b >= 32 && b < 127) || b === 9 || (b >= 0xa0 && b <= 0xff)) run += String.fromCharCode(b);
    else if (b === 13 || b === 10) {
      if (run) runs8.push(run);
      run = "";
    } else {
      if (run.length >= 3) runs8.push(run);
      run = "";
    }
  }
  if (run) runs8.push(run);
  const runs16: string[] = [];
  run = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i]! | (bytes[i + 1]! << 8);
    if ((code >= 32 && code < 0xd800 && code !== 0xfffd) || code === 9) run += String.fromCharCode(code);
    else {
      if (run.length >= 3) runs16.push(run);
      run = "";
    }
  }
  const keep = (lines: string[]) =>
    lines
      .map((line) => line.trim())
      .filter((line) => {
        if (/^[A-Z][A-Za-z ]{1,30}:$/.test(line)) return true; // "Rubric:" headings
        const w = line.split(/\s+/).filter((x) => /^[A-Za-z][A-Za-z'’.,:;()\-]*$|^\d+[\w.%-]*$/.test(x));
        return w.length >= 2 && w.length / line.split(/\s+/).length > 0.7;
      })
      .filter((line) => !/^(?:Times New Roman|Arial|Calibri|Symbol|Normal|Default Paragraph Font|Microsoft|Root Entry|WordDocument|SummaryInformation)/i.test(line))
      // Built-in style names stored alongside the text.
      .filter((line) => !/^(?:heading \d|(?:end|foot)note (?:reference|characters|text)|horizontal line|body text(?: \d)?|envelope (?:return|address)|table (?:contents|heading)|list(?: paragraph| bullet| number)?|caption|index|title|subtitle|header|footer|page number|hyperlink|quotations|preformatted text|frame contents)$/i.test(line));
  const a = keep(runs8);
  const b16 = keep(runs16);
  const best = b16.join(" ").length > a.join(" ").length ? b16 : a;
  return [...new Set(best)].join("\n").trim();
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode_failed"))), "image/jpeg", quality),
  );
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  let q = quality;
  let blob = await encodeJpeg(canvas, q);
  while (blob.size > MAX_IMAGE_BYTES && q > 0.4) {
    q -= 0.15;
    blob = await encodeJpeg(canvas, q);
  }
  return blob;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(blob);
  });
}

function drawRegion(bitmap: ImageBitmap, sy: number, sh: number): HTMLCanvasElement {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, sy, bitmap.width, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** True when a drawn page has no ink at all (never sent to OCR; see blank-image.ts). */
function canvasIsBlank(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    return looksBlank(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  } catch {
    return false;
  }
}

/**
 * The whole photo (kept as the stored copy) plus, for a tall page, two
 * overlapping halves that OCR reads in parallel at higher detail. Blank
 * halves are dropped so the vision model never "reads" an empty page.
 */
async function photoToJpeg(file: Blob): Promise<{ full: Blob; tiles: Blob[] }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const fullCanvas = drawRegion(bitmap, 0, bitmap.height);
    const full = await canvasToJpeg(fullCanvas);
    if (canvasIsBlank(fullCanvas)) return { full, tiles: [] };
    if (bitmap.height < bitmap.width * 1.25 || bitmap.height < 1400) return { full, tiles: [full] };
    const h = bitmap.height;
    const tiles: Blob[] = [];
    for (const canvas of [
      drawRegion(bitmap, 0, Math.round(h * 0.55)),
      drawRegion(bitmap, Math.round(h * 0.45), h - Math.round(h * 0.45)),
    ]) {
      if (!canvasIsBlank(canvas)) tiles.push(await canvasToJpeg(canvas));
    }
    return { full, tiles: tiles.length ? tiles : [full] };
  } finally {
    bitmap.close();
  }
}

/** Send page images to the server's vision OCR. Returns the joined text. */
async function ocrImages(
  paperId: string,
  images: Blob[],
): Promise<{ ok: true; text: string; pages: string[] } | { ok: false; error: string }> {
  const dataUrls = await Promise.all(images.map(blobToDataUrl));
  let res: Response;
  try {
    res = await fetch(`/api/papers/${paperId}/assignment/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: dataUrls }),
    });
  } catch {
    return { ok: false, error: "We couldn't reach the server to read this file. Check your connection and retry." };
  }
  const data = (await res.json().catch(() => null)) as { text?: string; pages?: string[]; error?: string } | null;
  if (!res.ok || !data?.text?.trim()) {
    return { ok: false, error: data?.error ?? "We couldn't read any text in this file." };
  }
  return { ok: true, text: data.text, pages: data.pages ?? [data.text] };
}

async function readPdf(paperId: string, data: Uint8Array): Promise<ClientExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "PasswordException") {
      return { ok: false, kind: "pdf", error: "This PDF is password-protected. Export an unlocked copy, or paste the text." };
    }
    return { ok: false, kind: "pdf", error: "This PDF couldn't be opened. It may be damaged; try exporting it again." };
  }
  const pageTexts: string[] = [];
  const scannedPages: number[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof item.str !== "string") continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
    const text = lines.join("\n").trim();
    pageTexts.push(text);
    if (words(text) < SCANNED_PAGE_WORDS) scannedPages.push(n);
  }
  let method: "pdf_text" | "ocr_grok_vision" = "pdf_text";
  if (scannedPages.length) {
    const images: Blob[] = [];
    const imagePages: number[] = [];
    for (const n of scannedPages.slice(0, MAX_OCR_PAGES)) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, MAX_IMAGE_EDGE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (canvasIsBlank(canvas)) continue;
      images.push(await canvasToJpeg(canvas, 0.8));
      imagePages.push(n);
    }
    if (images.length) {
      const ocr = await ocrImages(paperId, images);
      if (ocr.ok) {
        method = "ocr_grok_vision";
        imagePages.forEach((n, i) => {
          pageTexts[n - 1] = [pageTexts[n - 1], ocr.pages[i] ?? ""].filter(Boolean).join("\n");
        });
      } else if (pageTexts.every((t) => words(t) < SCANNED_PAGE_WORDS)) {
        return { ok: false, kind: "pdf", error: `This looks like a scanned PDF and we couldn't read it: ${ocr.error}` };
      }
    }
  }
  const text = pageTexts.filter(Boolean).join("\n\n").trim();
  if (!text) return { ok: false, kind: "pdf", error: "We couldn't find any text in this PDF." };
  return { ok: true, kind: "pdf", text, method };
}

async function readPhoto(paperId: string, file: Blob, kind: FileKind): Promise<ClientExtractResult> {
  let jpeg: { full: Blob; tiles: Blob[] };
  try {
    jpeg = await photoToJpeg(file);
  } catch {
    // Chrome and Firefox can't open HEIC/HEIF; convert it in the browser.
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      jpeg = await photoToJpeg(Array.isArray(converted) ? converted[0]! : converted);
    } catch {
      return {
        ok: false,
        kind,
        error: "We couldn't open this photo. Take a screenshot of it, or export it as JPG or PNG.",
      };
    }
  }
  if (!jpeg.tiles.length) {
    return {
      ok: false,
      kind,
      error: "This photo looks blank, with no writing on it. Retake it with the whole page in view, or tell Pau about the assignment.",
    };
  }
  const ocr = await ocrImages(paperId, jpeg.tiles);
  if (!ocr.ok) return { ok: false, kind, error: ocr.error };
  const text = jpeg.tiles.length === 2 ? mergeTileTexts(ocr.pages[0] ?? "", ocr.pages[1] ?? "") : ocr.text;
  return { ok: true, kind, text, method: "ocr_grok_vision", uploadBlob: jpeg.full };
}

async function readPages(paperId: string, file: File): Promise<ClientExtractResult> {
  const files = await unzipEntries(file, (name) => /(^|\/)(preview\.pdf|preview\.jpg|preview-web\.jpg|thumbnail\.jpg)$/i.test(name));
  const pdfName = Object.keys(files).find((name) => /preview\.pdf$/i.test(name));
  if (pdfName) {
    const result = await readPdf(paperId, files[pdfName]!);
    return result.ok ? { ...result, kind: "pages" } : { ...result, kind: "pages" };
  }
  const imageName =
    Object.keys(files).find((name) => /(^|\/)preview\.jpg$/i.test(name)) ??
    Object.keys(files).find((name) => /preview-web\.jpg$/i.test(name));
  if (imageName) {
    const result = await readPhoto(paperId, new Blob([files[imageName]!.slice()], { type: "image/jpeg" }), "pages");
    if (result.ok) {
      return { ...result, kind: "pages", uploadBlob: undefined, note: "Read from the first-page preview. Export as PDF for every page." };
    }
  }
  return {
    ok: false,
    kind: "pages",
    error: "We couldn't read this Pages file. In Pages, choose File → Export To → PDF or Word, then upload that.",
  };
}

export async function extractFileText(paperId: string, file: File): Promise<ClientExtractResult> {
  const kind = await detectFileKind(file);
  try {
    if (kind === "text") {
      const text = (await readText(file)).trim();
      return text ? { ok: true, kind, text, method: "txt" } : { ok: false, kind, error: "This text file is empty." };
    }
    if (kind === "html") {
      const text = htmlToText(await readText(file));
      return words(text) >= 5
        ? { ok: true, kind, text, method: "txt" }
        : { ok: false, kind, error: "We couldn't find the assignment text on this web page. Copy and paste it instead." };
    }
    if (kind === "rtf") {
      const text = rtfToText(await new Response(file).text());
      return words(text) >= 5
        ? { ok: true, kind, text, method: "txt" }
        : { ok: false, kind, error: "We couldn't find text in this RTF file. Try saving it as PDF or Word." };
    }
    if (kind === "word" || kind === "odt") {
      const text = kind === "word" ? await readDocx(file) : await readOdt(file);
      return words(text) >= 1
        ? { ok: true, kind, text, method: "docx" }
        : { ok: false, kind, error: `We couldn't find text in this ${KIND_LABEL[kind]}. Try saving it as PDF.` };
    }
    if (kind === "legacy_word") {
      const text = readLegacyDoc(new Uint8Array(await file.arrayBuffer()));
      return words(text) >= 15
        ? { ok: true, kind, text, method: "docx" }
        : {
            ok: false,
            kind,
            error: "We couldn't read this older Word (.doc) file. Save it as .docx or PDF and upload that.",
          };
    }
    if (kind === "pdf") return await readPdf(paperId, new Uint8Array(await file.arrayBuffer()));
    if (kind === "pages") return await readPages(paperId, file);
    if (kind === "photo") return await readPhoto(paperId, file, kind);
    return { ok: false, kind, error: rejectedTypeMessage(file.name) };
  } catch {
    return { ok: false, kind, error: `Something went wrong reading this ${KIND_LABEL[kind]}. Retry, or try another copy.` };
  }
}
