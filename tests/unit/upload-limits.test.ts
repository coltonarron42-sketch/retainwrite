import { describe, expect, it } from "vitest";
import {
  assertUploadBatch,
  guessMimeFromFilename,
  rejectLegacyDoc,
} from "@/lib/assignment/upload-limits";
import {
  extractUrlsFromText,
  mergeProvidedSources,
  normalizeSourceUrl,
  parseLinkField,
} from "@/lib/assignment/provided-sources";
import {
  ASSIGNMENT_MAX_FILE_BYTES,
  ASSIGNMENT_MAX_FILES,
} from "@/lib/config";

describe("upload limits", () => {
  it("accepts legacy .doc and other text formats, rejects video and archives", () => {
    expect(rejectLegacyDoc("prompt.doc")).toBeNull();
    for (const name of ["a.doc", "a.odt", "a.rtf", "a.pages", "a.html", "a.md", "a.webp"]) {
      expect(assertUploadBatch([], [{ filename: name, mime: "", byteSize: 10 }]).ok).toBe(true);
    }
    for (const name of ["clip.mp4", "song.mp3", "setup.exe", "files.zip"]) {
      const result = assertUploadBatch([], [{ filename: name, mime: "application/octet-stream", byteSize: 10 }]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/can't be read as an assignment/);
    }
  });

  it("guesses mime from extension", () => {
    expect(guessMimeFromFilename("a.PDF")).toBe("application/pdf");
    expect(guessMimeFromFilename("shot.heic")).toBe("image/heic");
  });

  it("enforces per-file and count caps", () => {
    const ok = assertUploadBatch(
      [],
      [{ filename: "a.pdf", mime: "application/pdf", byteSize: 1000 }],
    );
    expect(ok.ok).toBe(true);

    const tooBig = assertUploadBatch(
      [],
      [
        {
          filename: "huge.pdf",
          mime: "application/pdf",
          byteSize: ASSIGNMENT_MAX_FILE_BYTES + 1,
        },
      ],
    );
    expect(tooBig.ok).toBe(false);

    const many = assertUploadBatch(
      Array.from({ length: ASSIGNMENT_MAX_FILES }, (_, i) => ({
        filename: `f${i}.txt`,
        mime: "text/plain",
        byteSize: 10,
      })),
      [{ filename: "one-more.txt", mime: "text/plain", byteSize: 10 }],
    );
    expect(many.ok).toBe(false);
  });
});

describe("provided sources", () => {
  it("normalizes and dedupes URLs", () => {
    expect(normalizeSourceUrl("HTTPS://Example.COM/Path/")).toBe(
      "https://example.com/Path",
    );
    const merged = mergeProvidedSources([
      { url: "https://example.com/a/", origin: "manual" },
      { url: "https://example.com/a", title: "A", origin: "document_text" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("A");
  });

  it("parses link field and extracts URLs from text", () => {
    expect(parseLinkField("https://a.com\nhttps://b.com")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
    expect(extractUrlsFromText("See https://x.com/y. Also http://z.org/q")).toEqual([
      "https://x.com/y",
      "http://z.org/q",
    ]);
  });
});
