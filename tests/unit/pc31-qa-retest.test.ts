import { describe, expect, it } from "vitest";
import { reflectsSetAside, setAsideStyles } from "@/lib/stage1/style-negation";
import { chosenStyles, stylesIn } from "@/lib/stage1/north-turns";
import { asOnSheet } from "@/lib/stage1/lock-in";
import { needsBackground, noGoodSourcesParas, offTopicPages, topicTerms } from "@/lib/coach/source-quality";
import { publisherName, sourcesLine } from "@/lib/coach/sources-line";

const SAID = "Servant, not transformational, because Walton put associates first and didn't really sell a big vision.";

describe("QA retest da13848: #75 negation survives PC-31", () => {
  it("'Servant, not transformational' is one style in extraction, lock-in and checklist", () => {
    expect(stylesIn(SAID)).toEqual(["servant"]);
    expect(chosenStyles([SAID])).toEqual(["servant"]);
    expect(setAsideStyles(SAID)).toEqual(["transformational"]);
  });
  it("a Pau reflection naming the set-aside style is rejected; a faithful one passes", () => {
    expect(reflectsSetAside("Walton, showing servant and transformational leadership. Want to run with it?", SAID)).toBe(true);
    expect(reflectsSetAside("Walton put associates first: servant leadership, not transformational. Want to run with it?", SAID)).toBe(false);
    expect(reflectsSetAside("Walton put associates first, which is servant leadership. Want to run with it?", SAID)).toBe(false);
  });
  it("checklist keeps 'The assigned'", () => {
    const sheet = "Use the assigned HBR article 'What Makes a Leader?' by Daniel Goleman.";
    expect(asOnSheet("HBR article 'What Makes a Leader?' by Daniel Goleman", sheet)).toBe("The assigned HBR article 'What Makes a Leader?' by Daniel Goleman");
  });
});

describe("QA retest: background promise is always kept", () => {
  it("no gist and no background: no promise line", () => {
    const p = noGoodSourcesParas([], null);
    expect(p[0]).toBe("I couldn't find sources I'd want you to cite on this one.");
    expect(p.join(" ")).not.toMatch(/general background/);
    expect(needsBackground([])).toBe(true);
  });
  it("written background fills the promise; specifics are dropped", () => {
    const p = noGoodSourcesParas([], "Which fits your story?", [
      "• Transformational leaders raise a shared vision and push people to grow past what they thought they could do.",
      "• Jack Welch at General Electric is the classic case.",
      "• Studies show 72% of teams improve.",
    ]);
    expect(p[0]).toMatch(/here's general background instead/);
    expect(p[1]).toMatch(/^• Transformational leaders/);
    expect(p.join(" ")).not.toMatch(/Welch|72%/);
    expect(p.at(-1)).toBe("Which fits your story?");
  });
});

describe("QA retest minors: titles and relevance", () => {
  it("a Sources label is never a bare domain", () => {
    const line = sourcesLine([{ title: "collegepublishing.sagepub.com", url: "https://collegepublishing.sagepub.com/products/leadership-4-229889" }])!;
    expect(line).toMatch(/^Sources: \[SAGE \(collegepublishing\.sagepub\.com\)\]/);
    expect(publisherName("csuepress.columbusstate.edu")).toBe("Columbusstate (university site)");
  });
  it("pages that never mention the topic are off topic", () => {
    expect(topicTerms("real examples of servant leadership")).toEqual(["servant"]);
    const fetched = new Map([
      ["https://a.edu/x", { title: "Leadership case studies in education 4", text: "school principals ".repeat(40) }],
      ["https://b.edu/y", { title: "Servant leadership at a clinic", text: "servant leadership ".repeat(40) }],
    ]);
    expect([...offTopicPages(fetched, ["servant"])]).toEqual(["https://a.edu/x"]);
  });
});

describe("QA retest (749bd2a walk): one bullet per leader, readable titles", () => {
  it("three Nadella bullets from one page collapse to one", async () => {
    const { applySourceQuality } = await import("@/lib/coach/source-quality");
    const U = "https://hbr.org/2014/02/how-microsoft-avoided-the-peter-principle-with-nadella";
    const raw = [
      "• Satya Nadella at Microsoft shifted culture toward a growth mindset [hbr.org]",
      "• Satya Nadella at Microsoft received time and support during the CEO transition [hbr.org]",
      "• Satya Nadella revived Microsoft's innovation edge through partnerships [hbr.org]",
    ].join("\n");
    const fetched = new Map([[U, { title: "How Microsoft Avoided the Peter Principle with Nadella", text: "Satya Nadella Microsoft culture growth mindset transition support partnerships innovation" }]]);
    const q = applySourceQuality(raw, { mode: "research", sources: [{ title: "x", url: U }], read: [U], fetched });
    expect(q.kept).toBe(1);
    expect(q.checks.some((c) => c.tag === "duplicate")).toBe(true);
  });
  it("a cut-off citation title gives way to the page's own title", async () => {
    const { applySourceQuality } = await import("@/lib/coach/source-quality");
    const U = "https://csuepress.columbusstate.edu/sltp/vol2/iss1/3";
    const fetched = new Map([[U, { title: "Implementing Servant Leadership at Cleveland Clinic: A Case Study in Organizational Change", text: "Joseph Patrnchak Cleveland Clinic servant leadership" }]]);
    const q = applySourceQuality("• Joseph Patrnchak at Cleveland Clinic used servant leadership [csuepress.columbusstate.edu]", {
      mode: "research",
      sources: [{ title: '"Implementing Servant Leadership at Cleveland Clinic: A Case Study in O" by Jose', url: U }],
      read: [U],
      fetched,
    });
    expect(q.sources[0]!.title).toBe("Implementing Servant Leadership at Cleveland Clinic: A Case Study in Organizational Change");
  });
});

describe("QA retest (d3159a3 walk): student-blog platforms on .edu are weak", () => {
  it("sites.psu.edu / blogs.*.edu don't pass; a department page does", async () => {
    const { sourceTier } = await import("@/lib/coach/source-quality");
    expect(sourceTier("https://sites.psu.edu/leadership/2019/02/14/a-tale-of-two-dans/")).toBe(1);
    expect(sourceTier("https://blogs.umass.edu/x/servant")).toBe(1);
    expect(sourceTier("https://trace.tennessee.edu/utk_libpub/13")).toBeGreaterThanOrEqual(2);
  });
});

describe("QA retest (bd66554 walk): the lead name must be on the page", () => {
  it("'Microsoft' in a download link doesn't back a Satya Nadella bullet", async () => {
    const { supportedBy } = await import("@/lib/coach/source-quality");
    const line = "• Satya Nadella at Microsoft ran a listening tour [fortune.com]";
    expect(supportedBy(line, "Rapid Organizational Change Through Servant Leadership. Download Microsoft Word file")).toBe(false);
    expect(supportedBy(line, "How Satya Nadella changed Microsoft's culture")).toBe(true);
  });
});

describe("QA 5:13 walk: unsupported bullets never show as background", () => {
  it("weak-site gist shows; an unsupported one is left out; all-unsupported writes concept background", () => {
    const d = [
      { line: "• Cheryl Bachelder at Popeyes focused on franchisees [hbr.org]", why: "unsupported" as const },
      { line: "• Herb Kelleher at Southwest put employees first [online.ben.edu]", why: "weak" as const },
    ];
    const p = noGoodSourcesParas(d, null);
    expect(p.join(" ")).toMatch(/Kelleher/);
    expect(p.join(" ")).not.toMatch(/Bachelder/);
    expect(needsBackground([d[0]!])).toBe(true);
    expect(needsBackground(d)).toBe(false);
  });
});

describe("QA 5:32: hosting domains and status order", () => {
  it("hosting / dev domains never count and never show in 'Reading …'", async () => {
    const { sourceTier } = await import("@/lib/coach/source-quality");
    const { readingLine } = await import("@/lib/coach/thinking-status");
    for (const u of ["https://pilot.digitalocean.com/x", "https://foo.herokuapp.com/", "https://x.vercel.app/a", "https://y.netlify.app/", "https://me.github.io/p", "https://z.pages.dev/"]) {
      expect(sourceTier(u)).toBe(0);
      expect(readingLine(u)).toBeNull();
    }
  });
  it("phases: searching < reading < writing", async () => {
    const { statusPhase } = await import("@/lib/coach/thinking-status");
    expect(statusPhase("Searching for good examples…")).toBe(1);
    expect(statusPhase("Reading hbr.org…")).toBe(2);
    expect(statusPhase("Double-checking the sources…")).toBe(2);
    expect(statusPhase("Pulling it together…")).toBe(3);
  });
  it("a reading line never comes before the first searching line", async () => {
    const { statusFromEvent } = await import("@/lib/coach/thinking-status");
    const seen = { hosts: new Set<string>(), topic: "examples of transformational leadership" };
    const out = statusFromEvent({ type: "response.output_item.done", item: { type: "web_search_call", action: { type: "search", sources: [{ url: "https://hbr.org/x" }] } } }, seen);
    expect(out[0]).toMatch(/^Searching for examples of transformational leadership…$/);
    expect(out[1]).toBe("Reading hbr.org…");
  });
  it("the client drops a line from an earlier phase", async () => {
    const { fetchPauAnswer } = await import("@/lib/coach/pau-stream-client");
    const lines = ["Searching for x…", "Reading hbr.org…", "Searching a bit more on x…", "Pulling it together…", "Double-checking the sources…"].map((t) => JSON.stringify({ type: "status", text: t }));
    const body = `${lines.join("\n")}\n${JSON.stringify({ type: "done", paras: ["ok"] })}\n`;
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(body, { headers: { "content-type": "application/x-ndjson" } })) as typeof fetch;
    const shown: string[] = [];
    try {
      await fetchPauAnswer("/x", {}, { kind: "research", onStatus: (l) => shown.push(l) });
    } finally {
      globalThis.fetch = orig;
    }
    await new Promise((r) => setTimeout(r, 50));
    expect(shown[0]).toBe("Searching for x…");
    expect(shown).not.toContain("Searching a bit more on x…");
    expect(shown).not.toContain("Double-checking the sources…");
  });
});

describe("QA 5:32 walk: paywalled pages and cut titles", () => {
  it("JSON-LD article text counts as page text (HBR's paywalled pages)", async () => {
    const { htmlEvidence } = await import("@/lib/coach/page-evidence");
    const html = `<html><head><title>What the Best Transformational Leaders Do</title><script type="application/ld+json">{"@type":"Article","articleBody":"Satya Nadella, for instance, joined Microsoft in 1992 and worked his way up to running its cloud business."}</script></head><body><p>Subscribe to read</p></body></html>`;
    expect(htmlEvidence(html).text).toContain("Satya Nadella, for instance, joined Microsoft");
  });
  it("a cut citation title with no page title is cleaned, not shown raw", async () => {
    const { applySourceQuality } = await import("@/lib/coach/source-quality");
    const U = "https://csuepress.columbusstate.edu/sltp/vol2/iss1/3";
    const q = applySourceQuality("• Joseph Patrnchak at Cleveland Clinic used servant leadership [csuepress.columbusstate.edu]", {
      mode: "research",
      sources: [{ title: '"Implementing Servant Leadership at Cleveland Clinic: A Case Study in O" by Jose', url: U }],
      read: [U],
      fetched: new Map([[U, { title: "", text: "Joseph Patrnchak Cleveland Clinic servant leadership ".repeat(10) }]]),
    });
    expect(q.sources[0]!.title).toBe("Implementing Servant Leadership at Cleveland Clinic: A Case Study in…");
  });
});

describe("QA 5:32 walk: checklist keeps 'The assigned' when the parse rewords the item", () => {
  it("Goleman HBR article 'What Makes a Leader?' → The assigned Goleman HBR article …", () => {
    const sheet = "Using Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice) and the assigned HBR article 'What Makes a Leader?' by Daniel Goleman, write 1,200-1,500 words.";
    expect(asOnSheet("Goleman HBR article 'What Makes a Leader?'", sheet)).toBe("The assigned Goleman HBR article 'What Makes a Leader?'");
    expect(asOnSheet("HBR article 'What Makes a Leader?' by Daniel Goleman", sheet)).toBe("The assigned HBR article 'What Makes a Leader?' by Daniel Goleman");
    expect(asOnSheet("Chapter 4 of the Northouse textbook", sheet)).toBe("Chapter 4 of the Northouse textbook");
  });
});
