import { describe, expect, it } from "vitest";
import { parseAssignmentCorpus } from "@/lib/assignment/parse";

describe("described assignments", () => {
  it("a short typed description reaches the model instead of failing as too short", async () => {
    let asked = 0;
    const result = await parseAssignmentCorpus("5 page APA paper on whether teens need later school start times, due Dec 12", {
      mode: "live",
      minWords: 4,
      askModel: async () => {
        asked++;
        return {
          ok: true,
          model: "test",
          text: JSON.stringify({
            topic: "whether teens need later school start times",
            citationStyle: "APA",
            length: "5 pages",
          }),
        };
      },
    });
    expect(asked).toBe(1);
    expect(result.parseMeta.fallback).toBe(false);
    expect(result.requirements.length.value?.pagesMin).toBe(5);
  });

  it("sheet text still needs 20 words", async () => {
    const result = await parseAssignmentCorpus("5 page APA paper on teen sleep", { mode: "live", askModel: async () => ({ ok: false, reason: "x" }) });
    expect(result.parseMeta.reason).toBe("too_short");
  });
});
