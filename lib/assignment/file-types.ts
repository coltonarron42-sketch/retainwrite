/**
 * The one list of file types Stage 1 accepts for an assignment prompt.
 * Only formats we can actually pull text from. Video, audio, archives,
 * executables and everything else are rejected with a clear message.
 */

export type FileKind =
  | "pdf"
  | "word"
  | "legacy_word"
  | "odt"
  | "rtf"
  | "pages"
  | "html"
  | "text"
  | "photo"
  | "unknown";

type TypeRow = { kind: Exclude<FileKind, "unknown">; exts: string[]; mimes: string[] };

export const ASSIGNMENT_FILE_TYPES: TypeRow[] = [
  { kind: "pdf", exts: [".pdf"], mimes: ["application/pdf"] },
  {
    kind: "word",
    exts: [".docx"],
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  { kind: "legacy_word", exts: [".doc"], mimes: ["application/msword"] },
  { kind: "odt", exts: [".odt"], mimes: ["application/vnd.oasis.opendocument.text"] },
  { kind: "rtf", exts: [".rtf"], mimes: ["application/rtf", "text/rtf"] },
  {
    kind: "pages",
    exts: [".pages"],
    mimes: ["application/vnd.apple.pages", "application/x-iwork-pages-sffpages"],
  },
  { kind: "html", exts: [".html", ".htm"], mimes: ["text/html"] },
  { kind: "text", exts: [".txt", ".md", ".markdown"], mimes: ["text/plain", "text/markdown", "text/x-markdown"] },
  {
    kind: "photo",
    exts: [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".gif"],
    mimes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"],
  },
];

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  word: "Word file",
  legacy_word: "Word file",
  odt: "OpenDocument file",
  rtf: "RTF file",
  pages: "Pages file",
  html: "web page",
  text: "text file",
  photo: "photo",
  unknown: "file",
};

/** For the file input's accept attribute. */
export const ASSIGNMENT_ACCEPT = ASSIGNMENT_FILE_TYPES.flatMap((row) => [...row.exts, ...row.mimes]).join(",");

export const ACCEPTED_TYPES_SENTENCE =
  "PDF, Word (.docx or .doc), .odt, .rtf, Pages, text or Markdown, a saved web page (.html), or a photo (JPG, PNG, HEIC, WEBP)";

export function kindFromName(filename: string): FileKind {
  const lower = filename.toLowerCase();
  for (const row of ASSIGNMENT_FILE_TYPES) {
    if (row.exts.some((ext) => lower.endsWith(ext))) return row.kind;
  }
  return "unknown";
}

export function kindFromMime(mime: string): FileKind {
  const clean = mime.split(";")[0]!.trim().toLowerCase();
  for (const row of ASSIGNMENT_FILE_TYPES) {
    if (row.mimes.includes(clean)) return row.kind;
  }
  return "unknown";
}

export function mimeFromName(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const row of ASSIGNMENT_FILE_TYPES) {
    const index = row.exts.findIndex((ext) => lower.endsWith(ext));
    if (index >= 0) return row.kind === "photo" ? photoMime(row.exts[index]!) : row.mimes[0]!;
  }
  return null;
}

function photoMime(ext: string): string {
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return `image/${ext.slice(1)}`;
}

export const ALL_ASSIGNMENT_MIMES = ASSIGNMENT_FILE_TYPES.flatMap((row) => row.mimes);

export function rejectedTypeMessage(filename: string): string {
  return `${filename} can't be read as an assignment. Use ${ACCEPTED_TYPES_SENTENCE}, or paste the text.`;
}
