import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyRequirements, extractedField } from "@/lib/assignment/schema";
import { withYear } from "@/lib/copy/due-date";
import {
  applyConfirmUpdates,
  clarifyingAsk,
  emptyUpdates,
  finalizeResult,
  rulesClassify,
  type ConfirmResult,
} from "@/lib/stage1/confirm-reply";
import { pauPauSummaryBubbles, reconfirmParas, SUMMARY_OPENERS } from "@/lib/stage1/pau-pau";
import { __resetSpeech, armSpeech, takeNew } from "@/lib/voice/speech";

const read = (p: string) => readFileSync(p, "utf8");

function sheet() {
  const req = emptyRequirements();
  req.course = extractedField("ENG 101", 0.9);
  req.instructor = extractedField("Prof. Dana Ruiz", 0.9);
  req.paperType = extractedField("argumentative essay", 0.9);
  req.length = extractedField({ wordsMin: 1200, wordsMax: 1500, raw: "1,200-1,500 words" }, 0.9);
  req.citationStyle = extractedField("MLA 9" as const, 0.9);
  req.dueDate = extractedField("Nov 30", 0.9);
  req.formattingRules = extractedField(["Double-spaced", "1,200-1,500 words"], 0.9);
  return req;
}

describe("1: an unclear reply gets a real clarifying question and never advances", () => {
  it("'hmm maybe' re-asks with a way forward", () => {
    const r = rulesClassify("hmm maybe", null);
    expect(r.intent).toBe("ambiguous");
    expect(r.reply).toMatch(/^No worries\. Does anything in there look off, like the length, due date or sources\?/);
    expect(r.reply).toContain("looks good");
    expect(r.reply).not.toMatch(/not sure what you mean/i);
  });
  it("the model's bare 'Not sure what you mean.' is replaced by the clarifying ask", () => {
    const model: ConfirmResult = { intent: "ambiguous", reply: "Not sure what you mean.", updates: emptyUpdates(), keepAsNote: false, skipAsk: false };
    const out = finalizeResult(model, rulesClassify("hmm maybe", null), null);
    expect(out.intent).toBe("ambiguous");
    expect(out.reply).toBe(clarifyingAsk(null));
  });
  it("the clarifying ask fits what Pau Pau is waiting on", () => {
    expect(clarifyingAsk("sources")).toMatch(/source/);
    expect(clarifyingAsk("length")).toMatch(/words or pages/);
  });
  it("the client never advances on ambiguous", () => {
    const src = read("components/stages/stage1/pau-pau-confirm.tsx");
    const tail = src.slice(src.indexOf("// Ambiguous: a real clarifying question"));
    expect(tail.slice(0, 200)).not.toContain("onConfirm()");
  });
});

describe("2: a correction overwrites the old value everywhere", () => {
  it("'Got it, 1,500 words' replaces the 1,200–1,500 range even if the model only gave a max", () => {
    const model: ConfirmResult = {
      intent: "correction",
      reply: "Got it, 1,500 words.",
      updates: { ...emptyUpdates(), wordsMax: 1500 },
      keepAsNote: false,
      skipAsk: false,
    };
    const out = finalizeResult(model, rulesClassify("Got it, 1,500 words", null), null);
    const next = applyConfirmUpdates(sheet(), out.updates);
    expect(next.length.value).toMatchObject({ wordsMin: 1500, wordsMax: 1500 });
    const recap = reconfirmParas(next, null).join(" ");
    expect(recap).toContain("1,500 word");
    expect(recap).not.toContain("1,200");
  });
  it("a max-only update alone still replaces the whole range", () => {
    const next = applyConfirmUpdates(sheet(), { ...emptyUpdates(), wordsMax: 1500 });
    expect(next.length.value).toMatchObject({ wordsMin: 1500, wordsMax: 1500 });
    expect(next.length.value?.pagesMin).toBeUndefined();
  });
  it("due dates get the year of the next upcoming occurrence", () => {
    const now = new Date(2026, 10, 22);
    expect(withYear("Dec 3", now)).toBe("Dec 3, 2026");
    expect(withYear("Nov 22", now)).toBe("Nov 22, 2026");
    expect(withYear("Jan 5", now)).toBe("Jan 5, 2027");
    expect(withYear("December 3rd", now)).toBe("December 3, 2026");
    expect(withYear("12/3", now)).toBe("Dec 3, 2026");
    expect(withYear("Dec 3, 2027", now)).toBe("Dec 3, 2027");
    const next = applyConfirmUpdates(sheet(), { ...emptyUpdates(), dueDate: "Dec 3" });
    expect(next.dueDate.value).toMatch(/^Dec 3, 20\d\d$/);
    expect(reconfirmParas(next, null).join(" ")).toMatch(/due Dec 3, 20\d\d/);
  });
  it("the read-back says a due date with its year", () => {
    expect(pauPauSummaryBubbles(sheet(), { seed: 0 }).join(" ")).toMatch(/It's due Nov 30, 20\d\d\./);
  });
});

describe("3: the hesitation offer folds into the current reply", () => {
  it("renders inline inside the question's bubble, never as its own bubble", () => {
    const src = read("components/stages/stage1/assignment-intake.tsx");
    const turn = src.slice(src.indexOf("{/* Pau Pau's current turn. */}"));
    const group = turn.slice(0, turn.indexOf("</PauPauGroup>"));
    expect(group).toContain("<SparkExchange\n                  inline");
    expect(src).toContain('<SparkExchange inline turn={sparks[qid]!} active={false}');
    expect(src).not.toMatch(/\{isCurrent \? null : sparkFor\(item\.id\)\}\n\s*<EchoBubble/);
    const hes = read("components/stages/stage1/hesitation.tsx");
    expect(hes).toContain("if (inline) {");
    expect(hes).toContain('className="space-y-2 border-t border-ds-border pt-3 text-ds-text"');
  });
});

describe("4: openers are full sentences with specific citation styles", () => {
  it("no fragments, and 'This is for ENG 101 with Prof. Dana Ruiz: a …'", () => {
    const text = pauPauSummaryBubbles(sheet(), { seed: 0 }).join(" ");
    expect(text).toContain("This is for ENG 101 with Prof. Dana Ruiz: a 1,200–1,500 word argumentative essay in MLA 9 format.");
    expect(text).not.toMatch(/looks like|let's see here|…/i);
    for (const lead of SUMMARY_OPENERS) expect(lead).toMatch(/[.]$/);
  });
  it("the recap is full sentences too", () => {
    const recap = reconfirmParas(sheet(), null).join(" ");
    expect(recap).toMatch(/^Here's what I have now\. This is for ENG 101/);
  });
  it("length isn't repeated in the formatting line", () => {
    expect(pauPauSummaryBubbles(sheet(), { seed: 0 }).join(" ")).toContain("Formatting: double-spaced.");
  });
});

describe("5: a reload never re-reads old bubbles", () => {
  const g = globalThis as Record<string, unknown>;
  afterEach(() => {
    delete g.window;
    vi.unstubAllGlobals();
    __resetSpeech();
  });
  it("before any tap on this page load, everything on screen is history", () => {
    __resetSpeech();
    g.window = {};
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: false } });
    // Reload: upload screen, then the restored confirm screen swaps in (same scope).
    expect(takeNew("p1", [{ key: "ask", text: "What's the assignment?" }])).toEqual([]);
    expect(takeNew("p1", [{ key: "ask", text: "x" }, { key: "confirm:0", text: "This is for ENG 101." }])).toEqual([]);
    // Sticky browser activation alone (an in-app return) never arms her voice.
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
    expect(takeNew("p1", [{ key: "ask", text: "x" }, { key: "confirm:0", text: "This is for ENG 101." }, { key: "confirm:1", text: "Restored late." }])).toEqual([]);
    // The student acts (a reply or a choice): only a NEW turn is read.
    armSpeech();
    const fresh = takeNew("p1", [
      { key: "ask", text: "x" },
      { key: "confirm:0", text: "This is for ENG 101." },
      { key: "confirm:2", text: "Got it." },
    ]);
    expect(fresh.map((f) => f.key)).toEqual(["confirm:2"]);
  });
});

describe("1b: the clarifying ask matches what Pau Pau last asked", () => {
  it("only treats sources/length as pending when her last reply ended with that ask", () => {
    const src = read("components/stages/stage1/pau-pau-confirm.tsx");
    expect(src).toContain('(lastPau.paras.at(-1) ?? "").includes(PAU_PAU_ASK_TEXT[ask])');
    expect(src).toContain("pendingAsk: liveAsk,");
    expect(src).toContain("clarifyingAsk(liveAsk)");
  });
});
