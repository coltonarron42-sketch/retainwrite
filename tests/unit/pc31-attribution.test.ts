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

describe("QA 4:08 walk: product ids aren't titles", () => {
  it("skips 'leadership-4-229889'", async () => {
    const { slugTitle } = await import("@/lib/coach/sources-line");
    expect(slugTitle("https://collegepublishing.sagepub.com/products/leadership-4-229889")).toBeNull();
    expect(slugTitle("https://sk.sagepub.com/cases/servant-leadership-the-case-of-nelson-mandela")).toBe("Servant leadership the case of nelson mandela");
  });
});

describe("QA 4:08 walk 2: a site tag never makes a bullet 'about' that site", () => {
  const RG = "https://www.researchgate.net/publication/378934769_Leading_with_compassion_and_passion_A_case_study_on_servant_leadership_at_the_Crisis_Center_of_Tampa_Bay";
  const CC = "https://csuepress.columbusstate.edu/sltp/vol2/iss1/3";
  it("researchgate stays weak; the bullet is re-tagged to a good page that backs it, or dropped", async () => {
    const { applySourceQuality, sourceTier } = await import("@/lib/coach/source-quality");
    const line = "• Clara Reynolds at Crisis Center of Tampa Bay applied servant leadership to triple the budget [researchgate.net]";
    expect(sourceTier(RG, "Clara Reynolds at Crisis Center of Tampa Bay")).toBe(1);
    const fetched = new Map([[CC, { title: "Implementing Servant Leadership at Cleveland Clinic", text: "Joseph Patrnchak Cleveland Clinic" }]]);
    const dropped = applySourceQuality(line, { mode: "research", sources: [{ title: "x", url: RG }], read: [RG, CC], fetched });
    expect(dropped.kept).toBe(0);
    expect(dropped.checks[0]).toMatchObject({ supported: false, tag: "researchgate.net" });
    const fetched2 = new Map([[CC, { title: "Servant leadership case", text: "Clara Reynolds, CEO of the Crisis Center of Tampa Bay" }]]);
    const kept = applySourceQuality(line, { mode: "research", sources: [{ title: "x", url: RG }], read: [RG, CC], fetched: fetched2 });
    expect(kept.kept).toBe(1);
    expect(kept.checks[0]).toMatchObject({ supported: true, retagged: true, page: CC });
    expect(kept.sources.map((s) => s.url)).toEqual([CC]);
  });
  it("a reading lead must be backed by a good page", async () => {
    const { applySourceQuality } = await import("@/lib/coach/source-quality");
    const SAGE = "https://edge.sagepub.com/northouse9e";
    const raw = "From SAGE's page for Northouse, not your copy:\n• Chapter 4 covers the style approach.";
    const ok = applySourceQuality(raw, { mode: "reading", sources: [{ title: "x", url: SAGE }], fetched: new Map([[SAGE, { title: "Leadership | SAGE", text: "Peter G. Northouse Leadership Theory and Practice" }]]) });
    expect(ok.kept).toBe(1);
    expect(ok.checks[0]).toMatchObject({ tag: "lead", supported: true });
    const bad = applySourceQuality(raw, { mode: "reading", sources: [{ title: "x", url: SAGE }], fetched: new Map([[SAGE, { title: "Other book", text: "nothing relevant" }]]) });
    expect(bad.kept).toBe(0);
    expect(bad.text).toMatch(/^I couldn't find a page for your reading I'd trust/);
  });
});
