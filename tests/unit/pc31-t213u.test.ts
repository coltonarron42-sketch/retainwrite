import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { _clearResearchCache, getCachedResearch, normalizeQuery, putCachedResearch, researchCacheKey, searchCacheOn } from "@/lib/ai/research-cache";
import { searchingLine, readingLine, statusFromEvent, STATUS_ROTATION, WRITING_LINE } from "@/lib/coach/thinking-status";
import { dropBlocked, isBlockedSource, unreadReadingNames, UPLOAD_INVITE, withUploadInvite } from "@/lib/coach/reading-sources";
import { ndjsonLines, statusKindFor } from "@/lib/coach/pau-stream-client";
import { groundParas } from "@/lib/coach/grounding";
import { asideSpoken } from "@/lib/stage1/voice-turn";
import { PAU_TEXT_MODES } from "@/lib/coach/pau-prompt";

describe("t213u #1: dev/test search cache", () => {
  it("is never on in production, on for preview/dev, off with PAU_SEARCH_CACHE=0", () => {
    // t218u: off by default everywhere; PAU_SEARCH_CACHE=1 opts in, never in production.
    expect(searchCacheOn({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(false);
    expect(searchCacheOn({ VERCEL: "1", VERCEL_ENV: "production", PAU_SEARCH_CACHE: "1" })).toBe(false);
    expect(searchCacheOn({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(false);
    expect(searchCacheOn({ VERCEL: "1", VERCEL_ENV: "preview", PAU_SEARCH_CACHE: "1" })).toBe(true);
    expect(searchCacheOn({ NODE_ENV: "test" })).toBe(false);
    expect(searchCacheOn({ NODE_ENV: "test", PAU_SEARCH_CACHE: "1" })).toBe(true);
    expect(searchCacheOn({ NODE_ENV: "production", PAU_SEARCH_CACHE: "1" })).toBe(false);
  });
  it("keys on the normalized query plus paper context", () => {
    const base = { message: "Find me examples of servant leadership in business!", mode: "research", stage: 1, context: "ctx A" };
    expect(normalizeQuery("Find me  examples, of SERVANT leadership?")).toBe("find me examples of servant leadership");
    expect(researchCacheKey(base)).toBe(researchCacheKey({ ...base, message: "find me examples of servant leadership in business" }));
    expect(researchCacheKey(base)).not.toBe(researchCacheKey({ ...base, context: "ctx B" }));
    expect(researchCacheKey(base)).not.toBe(researchCacheKey({ ...base, mode: "reading" }));
  });
  it("round-trips in memory", async () => {
    _clearResearchCache();
    const k = researchCacheKey({ message: "x y z", mode: "research", stage: 2, context: "c" });
    expect(await getCachedResearch(k)).toBeNull();
    await putCachedResearch(k, { text: "• a", sources: [{ title: "t", url: "https://a.com" }], searches: 2 });
    expect((await getCachedResearch(k))?.text).toBe("• a");
  });
  it("the route uses it only for search turns, with a dev-only bypass", () => {
    const route = readFileSync("app/api/papers/[paperId]/coach/answer/route.ts", "utf8");
    expect(route).toContain("searchCacheOn()");
    expect(route).toMatch(/fresh: z\.boolean\(\)\.optional\(\)/);
  });
});

describe("t213u #3: live thinking status", () => {
  it("turns real steps into short lines", () => {
    expect(searchingLine('servant leadership examples site:hbr.org "business"')).toBe("Searching for servant leadership examples business…");
    expect(readingLine("https://www.strategypunk.com/top")).toBe("Reading strategypunk.com…");
    const seen = { writing: false, hosts: new Set<string>() };
    expect(statusFromEvent({ type: "response.output_item.added", item: { type: "web_search_call", action: { query: "servant leadership in business" } } }, seen)).toEqual(["Searching for servant leadership in business…"]);
    expect(statusFromEvent({ type: "response.output_text.annotation.added", annotation: { type: "url_citation", url: "https://online.ben.edu/x" } }, seen)).toEqual(["Reading online.ben.edu…"]);
    expect(statusFromEvent({ type: "response.output_text.annotation.added", annotation: { type: "url_citation", url: "https://online.ben.edu/y" } }, seen)).toEqual([]);
    expect(statusFromEvent({ type: "response.output_text.delta", delta: "•" }, seen)).toEqual([WRITING_LINE]);
    expect(statusFromEvent({ type: "response.output_text.delta", delta: "x" }, seen)).toEqual([]);
  });
  it("never shows her reasoning or a pirate site", () => {
    expect(statusFromEvent({ type: "response.reasoning_summary_text.delta", delta: "I should search…" })).toEqual([]);
    expect(readingLine("https://www.scribd.com/doc/1")).toBeNull();
  });
  it("rotation lines are short and in her voice", () => {
    for (const lines of Object.values(STATUS_ROTATION)) for (const l of lines) expect(l.length).toBeLessThan(40);
    expect(statusKindFor("research")).toBe("research");
    expect(statusKindFor("story")).toBe("think");
  });
  it("parses NDJSON with a partial tail", () => {
    const r = ndjsonLines('{"type":"status","text":"Searching…"}\n{"type":"tick"}\n{"type":"do');
    expect(r.lines).toHaveLength(2);
    expect(r.rest).toBe('{"type":"do');
  });
});

describe("t213u #4: unread readings", () => {
  it("blocks pirated hosts and bullets citing them", () => {
    expect(isBlockedSource("https://dokumen.pub/leadership-theory.pdf")).toBe(true);
    expect(isBlockedSource("https://us.sagepub.com/en-us/nam/leadership/book")).toBe(false);
    const d = dropBlocked([{ title: "", url: "https://www.pdfdrive.com/x" }, { title: "", url: "https://hbr.org/2004/01/what-makes-a-leader" }], ["• From pdfdrive.com: chapter text", "• From hbr.org: EI matters"]);
    expect(d.sources.map((s) => s.url)).toEqual(["https://hbr.org/2004/01/what-makes-a-leader"]);
    expect(d.paras).toEqual(["• From hbr.org: EI matters"]);
  });
  it("always invites their own copy, before the closing question", () => {
    expect(withUploadInvite(["• a", "Which fits?"])).toEqual(["• a", UPLOAD_INVITE, "Which fits?"]);
    expect(withUploadInvite(["Upload your PDF and I'll use it.", "Which?"])).toHaveLength(2);
  });
  it("finds the unread readings from the paper context", () => {
    const u = unreadReadingNames({ block: "Readings: Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice); HBR article by Daniel Goleman", readings: [] });
    expect(u.tokens).toEqual(expect.arrayContaining(["Northouse", "Goleman"]));
    const had = unreadReadingNames({ block: "", missing: ["Goleman, What Makes a Leader?"], readings: [{ title: "Goleman What Makes a Leader", text: "full text" }] });
    expect(had.titles).toHaveLength(0);
  });
  it("the reading prompt looks for the reading first and labels topic answers naturally", () => {
    expect(PAU_TEXT_MODES.reading).toMatch(/publisher's page/);
    expect(PAU_TEXT_MODES.reading).toMatch(/Never use or cite pirated copies/);
    expect(PAU_TEXT_MODES.reading).toMatch(/not from your copy/);
  });
});

describe("#69 side-answer route: grounding + one speech path", () => {
  it("'five body paragraphs' the assignment never set is replaced", () => {
    const g = groundParas(["Your essay should have five body paragraphs, one per idea."], { source: "1,200-1,500 words, one real leader, APA 7", unreadRefs: [] });
    expect(g.paras[0]).toMatch(/doesn't set a number of body paragraphs/);
  });
  it("voice reads the side answer, not its Sources line", () => {
    const s = asideSpoken(["• Kelleher put staff first.", "Sources: strategypunk.com · hbr.org", "Okay, back to my question."]);
    expect(s).not.toMatch(/Sources|strategypunk/);
  });
  it("Stage 1 asides are spoken only by #69's AsideVoice (no second signed say)", () => {
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).not.toMatch(/rt\.sayAnswer\(/);
    expect(intake).toMatch(/asideSpoken\(lastAside\.paras\)/);
  });
});

describe("t213u polish", () => {
  it("joins spaced-out site names and treats publisher lines as labeled", async () => {
    const { cleanPauParas } = await import("@/lib/coach/answer");
    expect(cleanPauParas(["• Covered on sagepub. com and hbr. org."])[0]).toBe("• Covered on sagepub.com and hbr.org.");
    expect(groundParas(["From the SAGE publisher page for the chapter: Northouse covers the style approach."], { source: "", unreadRefs: ["Northouse"] }).labeled).toBe(0);
  });
  it("probing turns get one quick retry at none instead of the canned fallback", () => {
    const route = readFileSync("app/api/papers/[paperId]/coach/answer/route.ts", "utf8");
    expect(route).toMatch(/chatOnce\("none", 7_000\)/);
  });
});

describe("t213u: Searching for <their ask>", () => {
  it("names the student's ask when the stream has no query", async () => {
    const { askTopic, statusFromEvent } = await import("@/lib/coach/thinking-status");
    expect(askTopic("find me examples of servant leadership in business")).toBe("examples of servant leadership in business");
    expect(askTopic("What does Northouse chapter 4 say about leadership?")).toBe("what Northouse chapter 4 says about leadership");
    const seen = { topic: "examples of servant leadership", searched: 0, hosts: new Set<string>() };
    expect(statusFromEvent({ type: "response.web_search_call.searching" }, seen)).toEqual(["Searching for examples of servant leadership…"]);
    expect(statusFromEvent({ type: "response.web_search_call.searching" }, seen)).toEqual(["Searching a bit more on examples of servant leadership…"]);
  });
});

describe("t213u: status topic and domain spacing (walk6)", () => {
  it("skips a rambly ask and joins spaced domains", async () => {
    const { askTopic } = await import("@/lib/coach/thinking-status");
    const { joinSpacedDomains } = await import("@/lib/coach/answer");
    expect(askTopic("I don't think this is working. Okay. Can you summarize the readings?")).toBeNull();
    expect(joinSpacedDomains("From sagepub. com the chapter covers")).toBe("From sagepub.com the chapter covers");
    expect(joinSpacedDomains("From hbr . org's page")).toBe("From hbr.org's page");
    expect(joinSpacedDomains("It ends here. Common sense says")).toBe("It ends here. Common sense says");
  });
});

describe("t218u: per-paper search budget", () => {
  it("keeps the per-turn cap and tapers per paper", async () => {
    const { turnSearchCap, PAPER_SEARCH_BUDGET, addPaperSearches, paperSearchesUsed, _clearSearchBudget } = await import("@/lib/ai/search-budget");
    expect(turnSearchCap(0, 2)).toBe(2);
    expect(turnSearchCap(0, 5)).toBe(3);
    expect(turnSearchCap(PAPER_SEARCH_BUDGET.soft, 3)).toBe(1);
    expect(turnSearchCap(PAPER_SEARCH_BUDGET.hard, 3)).toBe(0);
    expect(turnSearchCap(PAPER_SEARCH_BUDGET.hard - 1, 3)).toBe(1);
    // A paper can't get near 25: the worst case is soft + (hard - soft) one-search turns.
    let used = 0;
    for (let i = 0; i < 40; i++) used += turnSearchCap(used, 3);
    expect(used).toBeLessThanOrEqual(PAPER_SEARCH_BUDGET.hard);
    _clearSearchBudget();
    const id = "00000000-0000-4000-8000-000000000001";
    expect(await paperSearchesUsed(id)).toBe(0);
    expect(await addPaperSearches(id, 0, 2)).toBe(2);
    expect(await paperSearchesUsed(id)).toBe(2);
  });
  it("route uses the cap, logs paperSearches, and never retries uncapped", async () => {
    const fs = await import("node:fs");
    const route = fs.readFileSync("app/api/papers/[paperId]/coach/answer/route.ts", "utf8");
    expect(route).toContain("maxSearches: searchCap");
    expect(route).toContain("paperSearches");
    const gr = fs.readFileSync("lib/ai/grok-research.ts", "utf8");
    expect(gr).toContain("retry without web search");
  });
});

describe("t213u #4: no 'from general background on <reading>' phrasing (walk8)", () => {
  it("drops the inline phrase and leads with the natural label", async () => {
    const { groundParas } = await import("@/lib/coach/grounding");
    const r = groundParas(
      ["Servant leadership, from general background on Northouse's survey of approaches, means the leader puts the team's needs first.", "It treats leadership as service."],
      { source: "BUS 210 essay", unreadRefs: ["Northouse, Leadership: Theory and Practice, Chapter 4"] },
    );
    expect(r.paras[0]).toBe("I don't have your copy, so here's the general idea: Servant leadership means the leader puts the team's needs first.");
    expect(r.paras.join(" ")).not.toMatch(/from general background/i);
  });
});
