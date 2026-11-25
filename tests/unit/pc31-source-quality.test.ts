import { describe, expect, it } from "vitest";
import { applySourceQuality, noGoodSourcesParas, passes, sourceName, sourceTier } from "@/lib/coach/source-quality";
import { SOURCE_QUALITY } from "@/lib/coach/source-quality.config";
import { parseSourcesLine, sourcesLine } from "@/lib/coach/sources-line";
import { isBlockedSource } from "@/lib/coach/reading-sources";

describe("QA 3:46: source tiers", () => {
  it("blocks the sites QA saw, and pirated PDFs", () => {
    for (const u of [
      "https://www.strategypunk.com/servant",
      "https://online.ben.edu/blog/servant-leadership", // .edu marketing blog: not cited (tier 1)
      "https://jointhecollective.com/x",
      "https://www.shortform.com/blog/x",
      "https://helpfulprofessor.com/x",
      "https://peoplemanagingpeople.com/x",
      "https://library.uniq.edu.iq/storage/books/northouse.pdf",
      "https://www.coursehero.com/file/1",
      "https://www.ukessays.com/essays/x",
      "https://dokumen.pub/northouse.html",
    ])
      expect(passes(u), u).toBe(false);
    expect(sourceTier("https://library.uniq.edu.iq/storage/books/northouse.pdf")).toBe(0);
    expect(isBlockedSource("https://www.shortform.com/blog/x")).toBe(true);
  });
  it("prefers journals, publishers, HBR, news, universities and the company's own site", () => {
    expect(sourceTier("https://hbr.org/2017/servant")).toBe(3);
    expect(sourceTier("https://journals.sagepub.com/doi/10.1177/x")).toBe(3);
    expect(sourceTier("https://link.springer.com/article/x")).toBe(3);
    expect(sourceTier("https://sloanreview.mit.edu/article/x")).toBe(3);
    expect(sourceTier("https://www.reuters.com/business/x")).toBe(3);
    expect(sourceTier("https://edge.sagepub.com/northouse9e")).toBe(3);
    expect(sourceTier("https://www.psu.edu/course/leadership")).toBe(2);
    expect(sourceTier("https://www.southwest.com/about", "Herb Kelleher built Southwest Airlines by")).toBe(2);
    expect(sourceTier("https://www.southwest.com/about", "Cheryl Bachelder at Popeyes")).toBe(1);
    expect(sourceTier("https://randomleadershipblog.net/x")).toBe(1);
    expect(sourceName("https://hbr.org/x")).toBe("Harvard Business Review");
  });
  it("the list is maintainable data", () => {
    expect(SOURCE_QUALITY.blocked).toContain("helpfulprofessor.com");
    expect(SOURCE_QUALITY.strong).toContain("hbr.org");
  });
});

describe("QA 3:46: bullets only from sources that pass", () => {
  const sources = [
    { title: "Servant leadership examples", url: "https://www.strategypunk.com/x" },
    { title: "The Case for Servant Leadership", url: "https://hbr.org/2018/x" },
    { title: "Transformational leadership", url: "https://helpfulprofessor.com/x" },
  ];
  it("drops farm-backed bullets, keeps HBR with one clean attribution", () => {
    const raw = [
      "• Cheryl Bachelder rebuilt Popeyes by serving franchisees first. [hbr.org]",
      "• Herb Kelleher put Southwest employees first. strategypunk.com",
      "• Satya Nadella reset Microsoft's culture. Source: helpfulprofessor.com",
      "• An uncited claim with no site at all.",
      "Which one fits your paper?",
    ].join("\n");
    const q = applySourceQuality(raw, { mode: "research", sources, read: ["https://hbr.org/2018/x", "https://sloanreview.mit.edu/y"] });
    expect(q.kept).toBe(1);
    expect(q.text).toContain("• Cheryl Bachelder rebuilt Popeyes by serving franchisees first (Harvard Business Review).");
    expect(q.text).not.toMatch(/strategypunk|helpfulprofessor|\[hbr\.org\]/);
    expect(q.text).toContain("Which one fits your paper?");
    expect(q.sources.map((s) => s.url)).toEqual(["https://hbr.org/2018/x"]);
    expect(q.goodUnused).toEqual(["sloanreview.mit.edu"]);
  });
  it("reads xAI inline citations per bullet", () => {
    const raw = "• Bachelder at Popeyes [[1]](https://hbr.org/2018/x)\n• Kelleher at Southwest [[2]](https://www.strategypunk.com/x)";
    const q = applySourceQuality(raw, { mode: "research", sources });
    expect(q.kept).toBe(1);
    expect(q.text).toBe("• Bachelder at Popeyes (Harvard Business Review).");
  });
  it("reading: a lead resting on a pirated PDF is replaced and its bullets go", () => {
    const raw = "From library.uniq.edu.iq, not your copy:\n• Chapter 4 covers the style approach.\n• It reviews the Ohio State studies.\nWhat style are you leaning toward?";
    const q = applySourceQuality(raw, { mode: "reading", sources: [{ title: "pdf", url: "https://library.uniq.edu.iq/storage/books/northouse.pdf" }] });
    expect(q.kept).toBe(0);
    expect(q.text).toMatch(/^I couldn't find a page for your reading I'd trust/);
    expect(q.sources).toEqual([]);
  });
  it("reading: uncited bullets under a publisher lead stay", () => {
    const raw = "From SAGE's page for the chapter, not your copy:\n• Chapter 4 covers the style approach.\n• It reviews the Ohio State studies. [edge.sagepub.com]";
    const q = applySourceQuality(raw, { mode: "reading", sources: [{ title: "Northouse", url: "https://edge.sagepub.com/northouse9e" }] });
    expect(q.kept).toBe(2);
    expect(q.text).not.toMatch(/\[edge/);
  });
  it("nothing good: says so plainly, background labeled, no sites", () => {
    const p = noGoodSourcesParas([{ line: "• Kelleher put Southwest employees first. strategypunk.com" }], "Which fits?");
    expect(p[0]).toMatch(/couldn't find sources I'd want you to cite/);
    expect(p.join(" ")).not.toMatch(/strategypunk/);
    expect(p.at(-1)).toBe("Which fits?");
  });
});

describe("QA 3:46: one Sources line with linked titles", () => {
  it("links and parses", () => {
    const line = sourcesLine([{ title: "The Case for Servant Leadership", url: "https://hbr.org/2018/x" }])!;
    expect(line).toBe("Sources: [The Case for Servant Leadership (hbr.org)](https://hbr.org/2018/x)");
    expect(parseSourcesLine(line)).toEqual([{ text: "Sources: " }, { label: "The Case for Servant Leadership (hbr.org)", url: "https://hbr.org/2018/x" }]);
  });
  it("voice says attributions once", async () => {
    const { asideSpoken } = await import("@/lib/stage1/voice-turn");
    const s = asideSpoken(["• Bachelder rebuilt Popeyes (Harvard Business Review).", "• Kelleher put people first (Reuters).", "Sources: [x](https://hbr.org/x)"]);
    expect(s).toBe("Bachelder rebuilt Popeyes. Kelleher put people first. I found those in Harvard Business Review and Reuters.");
  });
});

describe("QA 3:46 walk: readable Sources titles", () => {
  it("uses the page slug when the title is a URL, never repeats a bare host", async () => {
    const { sourcesLine, slugTitle } = await import("@/lib/coach/sources-line");
    expect(slugTitle("https://hbr.org/2023/05/6-key-levers-of-a-successful-organizational-transformation?ab=x")).toBe("6 key levers of a successful organizational transformation");
    const line = sourcesLine([
      { title: "https://www.emerald.com/lodj/article/25/7/600/264455/Servant-leadership-at-Heritage-Bible-College-a", url: "https://www.emerald.com/lodj/article/25/7/600/264455/Servant-leadership-at-Heritage-Bible-College-a" },
      { title: "emerald.com", url: "https://www.emerald.com/jole/article/21/1/184/1273277/Using-a-Case-Study-to-Teach-Leaders-How-to-Enact" },
    ])!;
    expect(line).toContain("[Servant leadership at Heritage Bible College a (emerald.com)]");
    expect(line).toContain("[Using a Case Study to Teach Leaders How to Enact (emerald.com)]");
  });
});
