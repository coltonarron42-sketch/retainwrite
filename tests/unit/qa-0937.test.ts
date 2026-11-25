/** QA 9:37 AM round-4 bundle. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wellKnownWork } from "@/lib/stage1/well-known";
import { materialGateLabel, northstarChecklist } from "@/lib/stage1/intake-resume";

describe("TOP: well-known works get a deterministic, labeled summary", () => {
  it("Goleman always lists the five EI components", () => {
    const w = wellKnownWork("the assigned HBR article 'What Makes a Leader?' by Daniel Goleman");
    expect(w?.points.join(" ")).toMatch(/self-awareness, self-regulation, motivation, empathy, and social skill/);
  });
  it("Northouse is book level, never a chapter's contents", () => {
    const w = wellKnownWork("Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice)");
    expect(w?.bookLevel).toBe(true);
    expect(w?.points.join(" ")).not.toMatch(/chapter\s*\d/i);
  });
  it("obscure handouts are not in the catalog (she still won't guess)", () => {
    expect(wellKnownWork("Notes on the Quiet Kitchen")).toBeNull();
  });
  it("investigate uses the catalog and a short cap for known works", () => {
    const src = readFileSync("lib/server/paper-context/brief.ts", "utf8");
    expect(src).toContain("cat ? 7_000 : 10_000");
    expect(src).toContain("knowledge: catKnowledge");
  });
  it("the pre-confirm catch-up renders the material panel with its buttons", () => {
    expect(readFileSync("components/stages/stage1/pau-pau-confirm.tsx", "utf8")).toContain("data-confirm-material");
  });
});

describe("2. gate material state is accurate", () => {
  it("names the source, a pass, or waiting", () => {
    expect(materialGateLabel({ catchUpDone: true, materialShown: true, kinds: ["knowledge"], materialAnswer: "I haven't read it yet" })).toBe("Material: caught up from general background (not your copy yet)");
    expect(materialGateLabel({ catchUpDone: true, materialShown: true, kinds: ["reading"] })).toBe("Material: caught up from your own reading");
    expect(materialGateLabel({ catchUpDone: true, materialShown: true, kinds: ["reading"], materialAnswer: "skimmed the key points, going from those" })).toBe("Material: caught up from your own reading");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: ["reading"], materialAnswer: "first quick message" })).toBe("Material: waiting on the readings");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: ["reading"], materialAnswer: "I want to use Sam Walton", shownInChat: false })).toBe("Material: you haven't said yet whether you read it");
    expect(northstarChecklist({ confirmed: true, catchUpDone: true, decided: true, stanceOk: true, materialLabel: "Material: you haven't said yet whether you read it" })[1]!.done).toBe(false);
    expect(materialGateLabel({ catchUpDone: true, materialShown: true, kinds: ["knowledge"], lostAtStart: true })).toBe("Material: caught up from general background (not your copy yet)");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: [], materialAnswer: "I haven't read it yet, I don't have the packet", shownInChat: false })).toBe("Material: waiting on the readings");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: [], materialAnswer: "I read both of them" })).toBe("Material: caught up (you read it yourself)");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: [], materialAnswer: "I haven't read it yet" })).toBe("Material: waiting on the readings");
    const items = northstarChecklist({ confirmed: true, catchUpDone: true, decided: true, stanceOk: true, materialLabel: "Material: waiting on the readings" });
    expect(items[1]!.done).toBe(false);
  });
});

describe("1. pasted reading: key points first, then the ask", () => {
  it("falls back to the paste's own main lines, never just the ask", async () => {
    const { pastedReadingParas } = await import("@/lib/stage1/paper-context");
    const text = "Family meals have long served as a ritual of belonging in many homes. In the households studied, the evening table was where news was exchanged between parents and kids. Disputes were softened when everyone sat down to eat together.";
    const paras = pastedReadingParas({ title: "Pasted reading", summary: null, text, tail: "What do you make of it?" });
    expect(paras[1]).toMatch(/main lines/);
    expect(paras.filter((p) => p.startsWith("• ")).length).toBe(3);
    expect(paras.at(-1)).toBe("What do you make of it?");
  });
});

describe("3. templates", () => {
  it("the Stage 2 recap never reads 'Earlier you told me because'", async () => {
    const { stage2Earlier } = await import("@/lib/stages/stage2-intro");
    const t = stage2Earlier({ question: "q", answer: "because teams need a shared vision to get through a big change", pick: "their own" } as never, null);
    expect(t).not.toMatch(/told me because/i);
    expect(t).toMatch(/^Earlier you told me your reason: teams need a shared vision/);
    const t2 = stage2Earlier({ question: "q", answer: "adaptive leadership because teams need to learn as they go", pick: "their own" } as never, null);
    expect(t2).toMatch(/^Earlier you (?:picked adaptive leadership|told me adaptive leadership)/);
  });
  it("Body never says 'You picked their own.' and never re-offers the options", async () => {
    const { contextTeachCard } = await import("@/lib/coaching/teach");
    const opts = { question: "q", options: [{ label: "Transformational", why: "a" }, { label: "Situational", why: "b" }] };
    const card = contextTeachCard({ summary: null, options: opts, decision: { pick: "their own", answer: "adaptive leadership because teams learn as they go" } }, "r");
    expect(card?.ask).toBe("You picked adaptive leadership. Which moment shows it best?");
    expect(card?.qualities.join(" ")).not.toMatch(/Transformational|Situational/);
    expect(contextTeachCard({ summary: null, options: opts, decision: { pick: "their own", answer: "because" } }, "r")).toBeNull();
  });
  it("the logic alert quotes whole sentences, never cut mid-word", async () => {
    const { checkLogic } = await import("@/lib/coaching/logicCheck").then((m) => ({ checkLogic: (m as Record<string, unknown>).wholeQuote as (s: string) => string }));
    expect(checkLogic("I think transformational leadership works best for leading a team through change because people buy into a shared vision.")).toBe("I think transformational leadership works best for leading a team through change because people buy into a shared vision");
    const src = (await import("node:fs")).readFileSync("lib/coaching/logicCheck.ts", "utf8");
    expect(src).not.toContain("Which one does your paper argue?`.slice(");
  });
});

describe("4. Stage 3 gap coaching", () => {
  it("a named example in the Body counts, even one word ('Barra')", async () => {
    const { outlineGap } = await import("@/lib/stages/outline-map");
    expect(outlineGap("Body", ["Barra kept the work going after the recall"], null, "")).toBeNull();
    expect(outlineGap("Body", ["transformational leadership is good"], null, "")).toMatch(/example backs it up/);
  });
  it("Intro coaching previews an example named elsewhere", async () => {
    const { outlineGap } = await import("@/lib/stages/outline-map");
    expect(outlineGap("Introduction", ["I think transformational leadership works best for change"], null, "Mary Barra kept GM going after the recall")).toMatch(/previews your example, Mary Barra/);
  });
});

describe("5. quips", () => {
  it("retired stock lines are stripped and never dealt; the cartoon line is dealt once", async () => {
    const q = await import("@/lib/coach/quips");
    for (const line of ["Easier than group projects.", "My only skill is cheering. I'm cheering.", "One sanity check, mine and yours."]) {
      expect(q.dropStockFiller(`Lock it in? ${line}`)).toBe("Lock it in?");
    }
    expect(q.quipFor("paper-1", 0, "pick_lead")).toBe("I'd write it for you, but I'm legally a cartoon.");
    expect(q.quipFor("paper-1", 0, "logic_opener")).toBeNull();
    expect(q.quipFor("paper-1", 2, "pick_lead")).toBeNull();
  });
});

describe("7. sends are idempotent and never hang", () => {
  it("one send at a time, Send off in flight, stalled calls time out", () => {
    const confirm = readFileSync("components/stages/stage1/pau-pau-confirm.tsx", "utf8");
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    const composer = readFileSync("components/stages/stage1/chat-composer.tsx", "utf8");
    expect(confirm).toContain("if (sendLock.current) return;");
    expect(confirm).toContain("}, 15_000);");
    expect(intake).toContain("if (submitting || sendLock.current) {");
    expect(intake).toContain("}, 30_000);");
    expect(composer).toContain("disabled={blocked}");
  });
});

describe("QA 9:37 suite: gate label after the in-chat catch-up", () => {
  it("summaries shown under 'I haven't read it yet' read as caught up from general knowledge", async () => {
    const { materialGateLabel } = await import("@/lib/stage1/intake-resume");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: ["knowledge", "knowledge"], materialAnswer: "I haven't read it yet" })).toBe("Material: caught up from general background (not your copy yet)");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: ["knowledge"], materialAnswer: "no thanks" })).toBe("Material: you passed on the catch-up");
    expect(materialGateLabel({ catchUpDone: true, materialShown: false, kinds: [], materialAnswer: "I haven't read it yet" })).toBe("Material: waiting on the readings");
  });
});
