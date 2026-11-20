/**
 * Magic-byte MIME sniff for Stage 1 uploads.
 * Do not trust client Content-Type (§12.16).
 */

export type SniffResult =
  | { ok: true; mime: string }
  | { ok: false; reason: "empty" | "mismatch" | "unsupported" | "encrypted_pdf" };

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

function isAsciiText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  let printable = 0;
  const n = Math.min(bytes.length, 4096);
  for (let i = 0; i < n; i++) {
    const c = bytes[i]!;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127) || c >= 128) {
      printable++;
    }
  }
  return printable / n > 0.9;
}

/** Detect MIME from magic bytes. HEIC/HEIF via ftyp brand. */
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;

  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf"; // %PDF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // ZIP-based DOCX (PK..)
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    // Could be docx/xlsx/etc — treat as docx when extension/context says so; sniff alone → docx for allowlist
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  // HEIC/HEIF: ....ftypheic / heif / mif1
  if (bytes.length >= 12) {
    const brand = String.fromCharCode(
      bytes[8]!,
      bytes[9]!,
      bytes[10]!,
      bytes[11]!,
    );
    if (["heic", "heif", "mif1", "msf1"].includes(brand)) {
      return brand === "heif" || brand === "mif1" ? "image/heif" : "image/heic";
    }
  }

  if (isAsciiText(bytes)) {
    const head = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes.slice(0, 200))
      .toLowerCase();
    if (head.includes("<!doctype html") || head.includes("<html")) return null;
    if (head.includes("<svg")) return null;
    return "text/plain";
  }

  return null;
}

export function isPdfEncrypted(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return false;
  const sample = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 64_000)));
  return /\/Encrypt\b/.test(sample);
}

/**
 * Validate sniffed type against allowlist and optional client claim.
 */
export function assertSniffedUpload(
  bytes: Uint8Array,
  clientMime?: string,
): SniffResult {
  if (!bytes.length) return { ok: false, reason: "empty" };
  if (isPdfEncrypted(bytes)) return { ok: false, reason: "encrypted_pdf" };

  const sniffed = sniffMime(bytes);
  if (!sniffed || !ALLOWED.has(sniffed)) {
    return { ok: false, reason: "unsupported" };
  }

  if (clientMime) {
    const normalizedClient = clientMime.split(";")[0]!.trim().toLowerCase();
    const aliases: Record<string, string[]> = {
      "text/plain": ["text/plain", "text/markdown"],
      "text/markdown": ["text/plain", "text/markdown"],
      "image/heic": ["image/heic", "image/heif"],
      "image/heif": ["image/heic", "image/heif"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
      ],
    };
    const okAliases = aliases[sniffed] ?? [sniffed];
    if (
      normalizedClient &&
      !okAliases.includes(normalizedClient) &&
      normalizedClient !== "application/octet-stream"
    ) {
      // Soft mismatch: still accept sniff if client said octet-stream; hard reject clear lies
      if (
        normalizedClient.startsWith("text/html") ||
        normalizedClient === "image/svg+xml" ||
        normalizedClient.includes("executable")
      ) {
        return { ok: false, reason: "mismatch" };
      }
      if (!okAliases.includes(normalizedClient) && sniffed !== normalizedClient) {
        // JPEG claimed as PNG etc.
        if (
          (sniffed.startsWith("image/") && normalizedClient.startsWith("image/")) ||
          (sniffed === "application/pdf" && normalizedClient === "application/pdf")
        ) {
          /* image subtype drift — prefer sniff */
        } else if (
          sniffed.startsWith("image/") !== normalizedClient.startsWith("image/") ||
          (sniffed === "application/pdf") !== (normalizedClient === "application/pdf")
        ) {
          return { ok: false, reason: "mismatch" };
        }
      }
    }
  }

  return { ok: true, mime: sniffed };
}
