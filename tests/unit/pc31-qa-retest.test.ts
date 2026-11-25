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
