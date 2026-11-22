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

import { sniffMime } from "@/lib/assignment/mime-sniff";

export type FileKind = "pdf" | "word" | "text" | "photo" | "unknown";

export type ClientExtractResult =
  | {
      ok: true;
      kind: FileKind;
      text: string;
      method: "txt" | "pdf_text" | "docx" | "ocr_grok_vision";
      /** Re-encoded JPEG for photos (EXIF dropped), used for the storage copy. */
      uploadBlob?: Blob;
    }
  | { ok: false; kind: FileKind; error: string };

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  word: "Word file",
  text: "text file",
  photo: "photo",
  unknown: "file",
};

const MAX_OCR_PAGES = 4;
const MAX_IMAGE_EDGE = 1600;
/** Keep each image well under the 4.5 MB request limit (4 pages per request). */
const MAX_IMAGE_BYTES = 700_000;
/** Fewer words than this per page means the PDF page is probably a scan. */
const SCANNED_PAGE_WORDS = 12;

export async function detectFileKind(file: File): Promise<FileKind> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const sniffed = sniffMime(head);
  const name = file.name.toLowerCase();
  if (sniffed === "application/pdf") return "pdf";
  if (sniffed?.startsWith("image/")) return "photo";
  if (sniffed === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "word";
  // HEIC/HEIF and other ftyp images that sniffMime may not tag.
  if (/\.(heic|heif)$/.test(name) || file.type.startsWith("image/")) return "photo";
  if (/\.(txt|md)$/.test(name) || file.type.startsWith("text/") || sniffed?.startsWith("text/")) return "text";
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

async function readDocx(file: File): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => entry.name === "word/document.xml",
  });
  const xml = files["word/document.xml"];
  if (!xml) return "";
  return strFromU8(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

async function photoToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToJpeg(canvas);
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

async function readPdf(paperId: string, file: File): Promise<ClientExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
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
      images.push(await canvasToJpeg(canvas, 0.8));
    }
    if (images.length) {
      const ocr = await ocrImages(paperId, images);
      if (ocr.ok) {
        method = "ocr_grok_vision";
        scannedPages.slice(0, MAX_OCR_PAGES).forEach((n, i) => {
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

export async function extractFileText(paperId: string, file: File): Promise<ClientExtractResult> {
  const kind = await detectFileKind(file);
  try {
    if (kind === "text") {
      const text = (await readText(file)).trim();
      return text ? { ok: true, kind, text, method: "txt" } : { ok: false, kind, error: "This text file is empty." };
    }
    if (kind === "word") {
      const text = await readDocx(file);
      return text
        ? { ok: true, kind, text, method: "docx" }
        : { ok: false, kind, error: "We couldn't find text in this Word file. Try saving it as PDF." };
    }
    if (kind === "pdf") return await readPdf(paperId, file);
    if (kind === "photo") {
      let jpeg: Blob;
      try {
        jpeg = await photoToJpeg(file);
      } catch {
        return {
          ok: false,
          kind,
          error: "This browser can't open that photo format. Take a screenshot of it, or export it as JPG or PNG.",
        };
      }
      const ocr = await ocrImages(paperId, [jpeg]);
      if (!ocr.ok) return { ok: false, kind, error: ocr.error };
      return { ok: true, kind, text: ocr.text, method: "ocr_grok_vision", uploadBlob: jpeg };
    }
    return {
      ok: false,
      kind,
      error: "That file type isn't supported. Try a PDF, a Word file, a text file, or a photo.",
    };
  } catch {
    return { ok: false, kind, error: `Something went wrong reading this ${KIND_LABEL[kind]}. Retry, or try another copy.` };
  }
}
