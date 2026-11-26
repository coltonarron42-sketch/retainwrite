import { describe, expect, it } from "vitest";
import { classifyTurn, resolveMode } from "@/lib/coach/effort";
import { askTopic, searchingLine } from "@/lib/coach/thinking-status";
import { askedStyle, knownExamplesFor, KNOWN_EXAMPLES, researchCloser } from "@/lib/coach/known-examples";
import { backgroundExamples, noGoodSourcesParas, sourceTier } from "@/lib/coach/source-quality";

describe("QA 6:35 #1: an explicit ask for examples is research, even with a negation", () => {
  for (const [said, topic] of [
    ["Not transformational, just servant examples please.", "servant examples"],
    ["no transformational, give me servant ones", "servant examples"],
    ["servant examples only please", "servant examples only"],
    ["Not X, just Y examples", "Y examples"],
  ] as const) {
    it(said, () => {
      expect(classifyTurn(said).intent).toBe("research");
      expect(resolveMode("answer", classifyTurn(said).intent)).toBe("research");
      expect(askTopic(said)).toBe(topic);
    });
  }
  it("the negation only filters the style", () => {
    expect(askedStyle("Not transformational, just servant examples please.")).toBe("servant");
    expect(askedStyle("no transformational, give me servant ones")).toBe("servant");
  });
  it("their take with a negation (no examples asked) stays their take", () => {
    expect(classifyTurn("Servant, not transformational, because Walton put associates first and didn't really sell a big vision.").intent).not.toBe("research");
    expect(classifyTurn("I want to use Walton as my example").intent).not.toBe("research");
    expect(classifyTurn("give me an example sentence").intent).not.toBe("research");
  });
});

describe("QA 6:35 #2: the background block on an obscure ask", () => {
  it("a well-known style gets up to 2 named, figure-free examples under the label", () => {
    const ex = knownExamplesFor(askedStyle("find servant leadership examples at a rural Nebraska co-op"));
    const p = noGoodSourcesParas([], null, ex);
    expect(p).toContain("From general background (check before citing):");
    const shown = p.filter((x) => x.startsWith("• "));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThanOrEqual(2);
    for (const b of shown) expect(b).not.toMatch(/\d|https?:|\[|\(/);
  });
  it("the paper's chosen style is the fallback when the ask names none", () => {
    expect(askedStyle("anything on my leader's co-op?", ["servant"])).toBe("servant");
  });
  it("every table entry passes the background filter (named person, no figures)", () => {
    for (const v of Object.values(KNOWN_EXAMPLES)) expect(backgroundExamples(v)).toHaveLength(v.length);
  });
  it("nothing widely documented: no label and no list-implying question", () => {
    const p = researchCloser(noGoodSourcesParas([], "Which of these fits your story?", []), "Sam Walton");
    expect(p.join(" ")).not.toMatch(/general background|these/);
  });
});

describe("QA 6:35 #5: the closer matches the count", () => {
  it("one bullet", () => {
    expect(researchCloser(["• Sam Walton at Walmart listened to associates (hbr.org).", "Which of these fits?"], "Sam Walton").at(-1)).toBe("Does this fit your Sam Walton angle?");
  });
  it("several bullets", () => {
    expect(researchCloser(["• A (hbr.org).", "• B (hbr.org).", "Does this fit?"], "Sam Walton").at(-1)).toBe("Which of these fits your Sam Walton angle best?");
  });
  it("background examples count too", () => {
    const p = researchCloser(noGoodSourcesParas([], "Want to explore Sam Walton's approach instead?", knownExamplesFor("servant")), "Sam Walton");
    expect(p.at(-1)).toBe("Which of these fits your Sam Walton angle best?");
  });
});

describe("QA 6:35 minors", () => {
  it("status query text never shows OR/AND or minus operators", () => {
    expect(searchingLine('servant leadership real leader examples OR OR "CEO" -wiki')).toBe("Searching for servant leadership real leader examples CEO…");
  });
  it("predatory or low-quality journal hosts are weak", () => {
    expect(sourceTier("https://llm.corejournals.org/index.php/x")).toBe(1);
    expect(sourceTier("https://www.iosrjournals.org/x")).toBe(1);
    expect(sourceTier("https://journals.sagepub.com/x")).toBe(3);
  });
});

describe("QA 6:35 #4: the writing line is the last status", () => {
  it("shows 'Pulling it together…' even when it arrives right before the answer", async () => {
    const { fetchPauAnswer } = await import("@/lib/coach/pau-stream-client");
    const lines = ["Searching for x…", "Reading hbr.org…", "Checking a few sources…", "Pulling it together…"].map((t) => JSON.stringify({ type: "status", text: t }));
    const body = `${lines.join("\n")}\n${JSON.stringify({ type: "done", paras: ["ok"] })}\n`;
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(body, { headers: { "content-type": "application/x-ndjson" } })) as typeof fetch;
    const shown: string[] = [];
    try {
      await fetchPauAnswer("/x", {}, { kind: "research", onStatus: (l) => shown.push(l) });
    } finally {
      globalThis.fetch = orig;
    }
    expect(shown.at(-1)).toBe("Pulling it together…");
  });
});
