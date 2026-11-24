/** QA 8:31 AM round-3 bundle. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decisionQuestion,
  generalOptionsFor,
  guessPick,
  isVaguePick,
  looksLikePastedReading,
  parseStance,
  vaguePickProbe,
  assignmentDecisionAsk,
} from "@/lib/stage1/paper-context";
import { dropHedges, tidyPunct } from "@/lib/copy/tidy";
import { toSecondPerson } from "@/lib/stages/stage2-intro";
import { moreWordsNote, MORE_WORDS_NOTE } from "@/lib/stage1/chat-copy";
import { conceptTeachCard, guardTeachCard } from "@/lib/coaching/teach";
import { decisionAngles } from "@/lib/stage1/story-angles";
import { replaceClaim } from "@/lib/coaching/logicRevision";
import { outlineGap } from "@/lib/stages/outline-map";
import { dropStockFiller, oneQuipParas, STAGE2_QUIPS } from "@/lib/coach/quips";

const BUS = "BUS 210 Leadership essay. Using Chapter 4 of our textbook (Northouse) and Goleman's HBR article, write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example.";
const src = (p: string) => readFileSync(p, "utf8");

describe("R0: a lost student always gets real options", () => {
  const g = generalOptionsFor(BUS, true)!;
  it("general, well-established leadership options plus leader chips, labeled as general", () => {
    expect(g.basis).toBe("general");
    expect(g.options.map((o) => o.label).join(" ")).toMatch(/Transformational.*Situational.*Servant.*task vs\. relationship/);
    expect(g.people?.length).toBeGreaterThanOrEqual(2);
    const q = decisionQuestion(g);
    expect(q).toMatch(/general, well-established options from the field, not your chapter's own list/);
    expect(q).not.toMatch(/Chapter 4 (says|lists|covers)/i);
  });
  it("'the team one' maps to the closest offered option and is probed for why", () => {
    expect(guessPick("idk, the team one I guess", g.options)?.label).toMatch(/team management/);
    expect(vaguePickProbe("idk, the team one I guess", g.options)).toMatch(/^Sounds like you're leaning toward .*team management.*Why that one\?/);
  });
  it("no 'not listing the chapter's options' refusal", () => {
    expect(assignmentDecisionAsk(BUS) ?? "").not.toMatch(/not listing/);
  });
  it("server builds options material → sheet sides → general (never empty for a lost student)", () => {
    const b = src("lib/server/paper-context/brief.ts");
    expect(b).toContain("const general = generalOptionsFor(sheet, needsPerson);");
    expect(b).toContain('basis: "material"');
  });
});

describe("1. prepared stance from free text, no options on screen", () => {
  const t = "I read both… I want to argue transformational leadership, using Satya Nadella at Microsoft";
  it("is a pick, not vague, with the leader parsed", () => {
    expect(isVaguePick(t)).toBe(false);
    expect(parseStance(t)?.leader).toBe("Satya Nadella");
  });
});

describe("2. a long paste is material", () => {
  const p = "Family meals have long served as a ritual of belonging in many households. The evening table was where news was exchanged and disputes were softened over time. Children learned the unwritten rules of the family there, and the routines shaped who spoke and who listened.";
  it("detected, and never a pick", () => {
    expect(looksLikePastedReading(p)).toBe(true);
    expect(isVaguePick(p)).toBe(false);
  });
  it("paste detection runs before the reading-question and pick parsing", () => {
    const s = src("components/stages/stage1/assignment-intake.tsx");
    expect(s.indexOf("wins over any pick or question parsing")).toBeLessThan(s.indexOf("A question about a reading or the topic gets an answer"));
    expect(src("components/stages/stage1/pau-pau-confirm.tsx")).toContain('briefPost({ action: "reading", title: "Pasted reading"');
  });
});

describe("3. quoting and lessons", () => {
  it("never quotes or flips a raw 'I guess'", () => {
    expect(dropHedges("it's about the people stuff I guess")).toBe("it's about the people stuff");
    expect(toSecondPerson("it's about the people stuff I guess")).not.toMatch(/you guess/);
  });
  it("Body quick lesson is a real concept lesson, not the prompt", () => {
    const c = conceptTeachCard({ decision: { pick: "Transformational", answer: "I'd pick transformational because…" }, leader: { pick: "Satya Nadella" } }, "lesson_concept")!;
    expect(guardTeachCard(c).ok).toBe(true);
    expect(c.definition).toMatch(/shared vision/);
    expect(c.definition).not.toMatch(/assignment|team through change/i);
    expect(c.ask).toContain("Satya Nadella");
  });
  it("angle cards build on the decision, not the prompt", () => {
    const a = decisionAngles({ pick: "Transformational", leader: "Satya Nadella" })!;
    expect(a.map((x) => x.question).join(" ")).not.toMatch(/most effective for leading a team through change/);
    expect(a[0]!.question).toMatch(/Satya Nadella .*transformational leadership/);
  });
});

describe("4. punctuation", () => {
  it("fixes ?. and missing spaces", () => {
    expect(tidyPunct("what you want to argue?.")).toBe("what you want to argue?");
    expect(tidyPunct("before your point?Check it yourself")).toBe("before your point? Check it yourself");
    expect(src("components/stages/loop/stance-chat.tsx")).toContain('{" "}<span className="ml-2 text-[13px] font-semibold uppercase text-ds-muted">Check it yourself</span>');
  });
});

describe("5. Digging it up is optimistic", () => {
  it("set at send and kept until the answer is in", () => {
    const s = src("components/stages/stage1/assignment-intake.tsx");
    expect(s).toContain("await submitAnswerNow(opts0);");
    expect(s).not.toContain("if (lookup) setAsideBusy(null);");
  });
});

describe("6. the 25-word nudge varies and is specific", () => {
  it("different each try, names what's missing", () => {
    const a = moreWordsNote(8, 25, "Your early take", "I think transformational works best", 0);
    const b = moreWordsNote(8, 25, "Your early take", "I think transformational works best", 1);
    expect(a).not.toBe(b);
    expect(a).toMatch(/the why/);
    expect(moreWordsNote(14, 25, "Your early take", "I think transformational works best because people buy in", 2)).toMatch(/example/);
    expect(MORE_WORDS_NOTE.test(b)).toBe(true);
  });
});

describe("7. Say it simpler always appends", () => {
  it("server fallback and kept results", () => {
    expect(src("app/api/papers/[paperId]/intake/brief/route.ts")).toContain("shortPlain(p, body.mode === \"simpler\" ? 16 : 40)");
    expect(src("components/stages/stage1/assignment-intake.tsx")).toContain("moreKept.set(paperId, more)");
  });
});

describe("(a)-(d) follow-ups", () => {
  it("a revision keeps the earlier notes (thesis)", () => {
    expect(replaceClaim(["My thesis: transformational works best.", "Old claim here about it"], "New claim about Nadella")).toEqual(["My thesis: transformational works best.", "New claim about Nadella"]);
  });
  it("a new reply over the confirm is appended, with a line saying so", () => {
    expect(src("components/stages/loop/stance-chat.tsx")).toContain("{ text, append: true }");
  });
  it("the logic alert is visibly flagged", () => {
    const s = src("components/stages/loop/stance-chat.tsx");
    expect(s).toContain("border-ds-amber");
    expect(s).toContain("data-logic-flag");
  });
  it("outline gap: contradictory conclusion flagged; a named example counts", () => {
    expect(outlineGap("Conclusion", ["In the end transformational leadership isn't really the best for change."], "Transformational leadership works best for change.")).toMatch(/but your thesis says/);
    expect(outlineGap("Body", ["Transformational leaders sell a shared vision", "Satya Nadella at Microsoft"])).toBeNull();
  });
  it("no stock filler quips", () => {
    expect((STAGE2_QUIPS as readonly string[]).some((q) => /Rubrics love|Look at us/.test(q))).toBe(false);
    expect(dropStockFiller("Rubrics love this stuff. What's your example?")).toBe("What's your example?");
    expect(oneQuipParas(["Look at us, being organized.", "Next question?"])).toEqual(["Next question?"]);
  });
});

describe("QA 8:31 live fixes", () => {
  it("drops unverified chapter-content claims", async () => {
    const { dropChapterClaims } = await import("@/lib/stage1/paper-context");
    const t = "The assignment asks you to pick one style. Northouse Chapter 4 covers the main styles like transformational and servant leadership. Want the options?";
    expect(dropChapterClaims(t)).toBe("The assignment asks you to pick one style. Want the options?");
    expect(dropChapterClaims("The assignment says to use Chapter 4 and the HBR article.")).toBe("The assignment says to use Chapter 4 and the HBR article.");
  });
});

describe("QA 8:31 live fixes (2)", () => {
  it("lock-in keeps every kept note, not only the last", () => {
    const src = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    const onConfirm = src.slice(src.indexOf("function onConfirm("), src.indexOf("async function onLogicOpener("));
    expect(onConfirm).toContain("ideas: kept,");
    expect(onConfirm).not.toContain(".at(-1)");
  });
  it("a person question needs real names, not abstract descriptions", () => {
    const src = readFileSync("lib/server/paper-context/brief.ts", "utf8");
    expect(src).toContain("realPick && grounded.length >= 2");
  });
});
