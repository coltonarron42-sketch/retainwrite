/**
 * Client/demo helpers to turn uploaded blobs into text without a server.
 * Binary files wait for server OCR / native extract — paste is never required.
 */

export type LocalExtractResult = {
  text: string;
  method: "txt" | "paste" | "pdf_text" | "docx" | "ocr_pending" | "unsupported";
  note?: string;
  /** True when the file needs a server/OCR pass before text is available. */
  pending: boolean;
};

export async function extractTextFromFile(file: File): Promise<LocalExtractResult> {
  const name = file.name.toLowerCase();
  const mime = file.type || "";

  if (
    mime === "text/plain" ||
    mime === "text/markdown" ||
    name.endsWith(".txt") ||
    name.endsWith(".md")
  ) {
    let text = await file.text();
    if (text.includes("\uFFFD") && text.length > 0) {
      const buf = await file.arrayBuffer();
      text = new TextDecoder("latin1").decode(buf);
    }
    return { text, method: "txt", pending: false };
  }

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return {
      text: "",
      method: "pdf_text",
      pending: true,
      note: "Reading this PDF…",
    };
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return {
      text: "",
      method: "docx",
      pending: true,
      note: "Reading this Word file…",
    };
  }

  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(name)) {
    return {
      text: "",
      method: "ocr_pending",
      pending: true,
      note: "Reading this photo…",
    };
  }

  return {
    text: "",
    method: "unsupported",
    pending: false,
    note: "That file type isn't supported. Try a PDF, a Word file, a text file, or a photo.",
  };
}
