/**
 * Client/demo helpers to turn uploaded blobs into text without a server.
 * PDF/DOCX/images fall back to placeholders the student can replace via paste.
 */

export type LocalExtractResult = {
  text: string;
  method: "txt" | "paste" | "pdf_text" | "docx" | "ocr_pending" | "unsupported";
  note?: string;
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
    // latin-1 fallback if UTF-8 produced lots of replacement chars
    if (text.includes("\uFFFD") && text.length > 0) {
      const buf = await file.arrayBuffer();
      text = new TextDecoder("latin1").decode(buf);
    }
    return { text, method: "txt" };
  }

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return {
      text: "",
      method: "pdf_text",
      note: "PDF uploaded — full text extraction runs when OCR/parse is available. Paste key pages if you need the card now.",
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
      note: "Word file uploaded — text extraction runs on the server. Paste the prompt if you need the card now.",
    };
  }

  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(name)) {
    return {
      text: "",
      method: "ocr_pending",
      note: "Photo uploaded — OCR runs next. You can also paste what you can read.",
    };
  }

  return {
    text: "",
    method: "unsupported",
    note: "This file type isn’t supported for local preview.",
  };
}
