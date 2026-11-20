import { describe, expect, it } from "vitest";
import {
  assertSniffedUpload,
  isPdfEncrypted,
  sniffMime,
} from "@/lib/assignment/mime-sniff";

describe("mime sniff", () => {
  it("detects PDF, JPEG, PNG", () => {
    expect(sniffMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(
      "application/pdf",
    );
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
  });

  it("detects plain text and rejects HTML", () => {
    const txt = new TextEncoder().encode("Write a 5 page research paper in APA.");
    expect(sniffMime(txt)).toBe("text/plain");
    const html = new TextEncoder().encode("<!doctype html><html><body>x</body></html>");
    expect(sniffMime(html)).toBeNull();
  });

  it("flags encrypted PDFs", () => {
    const enc = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Encrypt 2 0 R >>");
    expect(isPdfEncrypted(enc)).toBe(true);
    expect(assertSniffedUpload(enc).ok).toBe(false);
  });

  it("accepts allowlisted sniffed bytes", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const result = assertSniffedUpload(pdf, "application/pdf");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mime).toBe("application/pdf");
  });
});
