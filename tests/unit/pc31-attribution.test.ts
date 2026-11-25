import { describe, expect, it, vi } from "vitest";
import { applySourceQuality, keyTerms, supportedBy } from "@/lib/coach/source-quality";
import { htmlEvidence } from "@/lib/coach/page-evidence";

const MARINES = "https://hbr.org/2017/02/how-the-u-s-marines-encourage-service-based-leadership";
const HUMBLE = "https://hbr.org/2018/12/how-humble-leadership-really-works";

describe("QA 4:08: attribution support check", () => {
  it("names are the key terms", () => {
    expect(keyTerms("• Jungkiu Choi at Standard Chartered asked how to help staff [hbr.org]").entities).toEqual(["jungkiu choi", "standard chartered"]);
  });
  it("the Jungkiu Choi bullet isn't supported by the Marines page", () => {
    expect(supportedBy("• Jungkiu Choi at Standard Chartered asked how to help staff", "How the U.S. Marines Encourage Service-Based Leadership hbr 2017 02 how the u s marines encourage service based leadership")).toBe(false);
    expect(supportedBy("• Jungkiu Choi at Standard Chartered asked how to help staff", "How Humble Leadership Really Works ... Jungkiu Choi, head of consumer banking at Standard Chartered ...")).toBe(true);
  });
  it("re-tags to the page that does support it, or drops the bullet", () => {
    const raw = "• Jungkiu Choi at Standard Chartered asked how to help staff, lifting satisfaction [hbr.org]\n• Herb Kelleher put Southwest employees first [hbr.org]\nWhich fits?";
    const fetched = new Map([
      [MARINES, { title: "How the U.S. Marines Encourage Service-Based Leadership", text: "Marines officers eat last ..." }],
      [HUMBLE, { title: "How Humble Leadership Really Works", text: "Jungkiu Choi, head of consumer banking at Standard Chartered Bank, ..." }],
    ]);
    const q = applySourceQuality(raw, { mode: "research", sources: [{ title: "x", url: MARINES }], read: [MARINES, HUMBLE], fetched });
    expect(q.kept).toBe(1);
    expect(q.text).toContain("Jungkiu Choi at Standard Chartered asked how to help staff, lifting satisfaction (Harvard Business Review).");
    expect(q.text).not.toContain("Kelleher");
    expect(q.sources.map((s) => s.url)).toEqual([HUMBLE]);
    expect(q.checks.map((c) => [c.supported, c.page])).toEqual([[true, HUMBLE], [false, MARINES]]);
    expect(q.dropped[0]!.why).toBe("unsupported");
  });
  it("an inline-cited page that doesn't mention the leader is moved to one that does", () => {
    const raw = `• Jungkiu Choi at Standard Chartered asked how to help staff [[1]](${MARINES})`;
    const fetched = new Map([[MARINES, { title: "Marines", text: "officers eat last" }], [HUMBLE, { title: "Humble", text: "Jungkiu Choi of Standard Chartered" }]]);
    const q = applySourceQuality(raw, { mode: "research", sources: [], read: [HUMBLE], fetched });
    expect(q.checks[0]).toMatchObject({ supported: true, retagged: true, page: HUMBLE });
  });
  it("reads a page's title, meta and text", () => {
    const e = htmlEvidence('<html><head><title>How Humble Leadership Really Works</title><meta name="description" content="Jungkiu Choi &amp; Standard Chartered"></head><body><script>x</script><p>Text</p></body></html>');
    expect(e.title).toBe("How Humble Leadership Really Works");
    expect(e.text).toContain("Jungkiu Choi & Standard Chartered");
    expect(e.text).not.toContain("<script>");
  });
});

describe("QA 4:08: the per-turn search cap is enforced in code", () => {
  it("ends the request when a search past the cap starts", async () => {
    vi.resetModules();
    const events = [
      { type: "response.output_item.added", item: { type: "web_search_call", id: "ws1" } },
      { type: "response.output_item.done", item: { type: "web_search_call", id: "ws1", action: { type: "search", query: "q1", sources: [{ url: "https://hbr.org/a", title: "A" }] } } },
      { type: "response.output_item.added", item: { type: "web_search_call", id: "ws2" } },
      { type: "response.output_item.done", item: { type: "web_search_call", id: "ws2", action: { type: "open_page", sources: [] } } },
      { type: "response.output_item.added", item: { type: "web_search_call", id: "ws3" } },
      { type: "response.output_text.delta", delta: "never reached" },
    ];
    let seen = 0;
    vi.doMock("@/lib/ai/grok", () => ({
      getGrokClient: () => ({
        responses: {
          create: async () => ({
            async *[Symbol.asyncIterator]() {
              for (const e of events) {
                seen++;
                yield e;
              }
            },
          }),
        },
      }),
    }));
    const { grokResearch } = await import("@/lib/ai/grok-research");
    const r = await grokResearch({ system: "s", user: "u", effort: "low", search: true, maxSearches: 2, timeoutMs: 5000 });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.reason).toBe("capped");
    expect(seen).toBe(5);
    expect(r.ok ? [] : r.read).toEqual(["https://hbr.org/a"]);
    vi.doUnmock("@/lib/ai/grok");
  });
});
