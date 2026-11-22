import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/ai/grok", () => ({ getGrokClient: () => ({ chat: { completions: { create } } }) }));

import { transcribePage } from "@/lib/assignment/ocr";
import { MODEL_FAST, MODEL_STRONG } from "@/lib/config";

const PAGE = "ENG 102 Research Essay. Write 1,500 words in MLA format on a question you choose.";
const reply = (text: string) => ({ choices: [{ message: { content: text } }] });

describe("OCR hedging when the fast model is out of capacity", () => {
  afterEach(() => {
    create.mockReset();
    vi.useRealTimers();
  });

  it("a 429 on the fast model starts the strong model at once instead of failing", async () => {
    process.env.GROK_API_KEY = "test";
    create.mockImplementation(async (body: { model: string }) => {
      if (body.model === MODEL_FAST) throw new Error('429 "The model is currently at capacity"');
      return reply(PAGE);
    });
    const res = await transcribePage({ imageUrl: "data:image/png;base64,AA", page: 1 });
    expect(res.text).toContain("1,500 words");
    expect(create.mock.calls.map((c) => c[0].model)).toContain(MODEL_STRONG);
  });

  it("a fast read stuck in a queue gets a strong read in parallel after the hedge delay", async () => {
    process.env.GROK_API_KEY = "test";
    vi.useFakeTimers();
    create.mockImplementation((body: { model: string }) =>
      body.model === MODEL_FAST ? new Promise(() => {}) : Promise.resolve(reply(PAGE)),
    );
    const pending = transcribePage({ imageUrl: "data:image/png;base64,AA", page: 1 });
    await vi.advanceTimersByTimeAsync(6_100);
    const res = await pending;
    expect(res.text).toContain("MLA");
    expect(create).toHaveBeenCalledTimes(2);
  });
});
