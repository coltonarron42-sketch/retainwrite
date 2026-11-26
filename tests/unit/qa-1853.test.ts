// @vitest-environment jsdom
// QA 6:53 PM: Stage 2 draft survives a reopen and clears on send; one welcome
// per return (never on a stage-to-stage move); the cartoon joke once per paper.
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { stanceDraftKey } from "@/components/stages/loop/coaching-loop";
import { claimReturn, paperFromPath, resetReturnForTests } from "@/components/stages/stage1/welcome-back";
import { STOCK_POOLS, logicOpenerText } from "@/components/stages/loop/stance-chat";
import { CARTOON_FAMILY, SIGNATURE_QUIP, STAGE2_QUIPS, isCartoonJoke, oneQuip, quipFor } from "@/lib/coach/quips";
import { WELCOME_BACK_LINES } from "@/lib/coach/welcome-back";
import { PAU_PERSONALITY, SAMPLE_QUIPS } from "@/lib/coach/personality";
import { clearLocalDraft, newerDraftText, readLocalDraft, writeLocalDraft } from "@/lib/papers/local-draft";

describe("Stage 2 composer draft (QA 6:53 #1)", () => {
  it("is saved per paper, section and device, and the newer copy wins", () => {
    const k1 = stanceDraftKey("intro")!;
    const k2 = stanceDraftKey("body")!;
    expect(k1).toBe("stance:intro:draft");
    expect(stanceDraftKey(null)).toBeNull();
    writeLocalDraft("p1", k1, "my intro idea");
    writeLocalDraft("p1", k2, "body idea");
    expect(readLocalDraft("p1", k1)?.text).toBe("my intro idea");
    expect(readLocalDraft("p2", k1)).toBeNull();
    expect(newerDraftText(readLocalDraft("p1", k1), { text: "old", updatedAt: new Date(0).toISOString() })).toBe("my intro idea");
    expect(newerDraftText(null, { text: "server copy", updatedAt: new Date().toISOString() })).toBe("server copy");
    clearLocalDraft("p1", k1);
    expect(readLocalDraft("p1", k1)).toBeNull();
    expect(readLocalDraft("p1", k2)?.text).toBe("body idea");
  });
  it("coaching loop restores it on load, keeps a device copy, and clears both on send", () => {
    const src = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    expect(src).toMatch(/enabled: persist && stage === 2 && Boolean\(session\),\n\s*localCopy: true,/);
    expect(src).toMatch(/newerDraftText\(readLocalDraft\(paperId, draftKey\)/);
    expect(src).toMatch(/setIdea\(\(cur\) => \(cur\.trim\(\) \? cur : unsent\)\)/);
    expect(src).toMatch(/clearLocalDraft\(paperId, key\);\n\s*if \(persist\) void persistField\(paperId, \{ fieldKey: key, text: ""/);
  });
});

describe("welcome once per return (QA 6:53 #2)", () => {
  beforeEach(() => {
    resetReturnForTests();
    window.history.replaceState(null, "", "/app");
  });
  it("reads the paper from the path", () => {
    expect(paperFromPath("/app/papers/abc/stage/3")).toBe("abc");
    expect(paperFromPath("/app/papers/abc")).toBe("abc");
    expect(paperFromPath("/app")).toBeNull();
  });
  it("dashboard -> Stage 3 welcomes; Stage 3 -> Stage 2 in the same session does not", () => {
    window.history.pushState(null, "", "/app/papers/A/stage/3");
    expect(claimReturn("A")).toBe(true);
    window.history.pushState(null, "", "/app/papers/A/stage/2");
    expect(claimReturn("A")).toBe(false);
    window.history.pushState(null, "", "/app/papers/A");
    expect(claimReturn("A")).toBe(false);
  });
  it("a trip to the dashboard is a new return; another paper is its own return", () => {
    window.history.pushState(null, "", "/app/papers/A/stage/2");
    expect(claimReturn("A")).toBe(true);
    window.history.pushState(null, "", "/app");
    window.history.pushState(null, "", "/app/papers/A/stage/2");
    expect(claimReturn("A")).toBe(true);
    window.history.pushState(null, "", "/app/papers/B/stage/1");
    expect(claimReturn("B")).toBe(true);
    window.history.back();
  });
  it("a reload or new session starts fresh (module state reset)", () => {
    window.history.pushState(null, "", "/app/papers/A/stage/3");
    expect(claimReturn("A")).toBe(true);
    resetReturnForTests();
    expect(claimReturn("A")).toBe(true);
  });
  it("the hook claims the return before picking a line", () => {
    const src = readFileSync("components/stages/stage1/welcome-back.tsx", "utf8");
    // PC-28: the focus decision is made once; the line is only picked when the return is claimed.
    expect(src).toMatch(/const returning = claimReturn\(paperId\);/);
    expect(src.indexOf("claimReturn(paperId)")).toBeLessThan(src.indexOf("welcomeBackLine(fillRef.current"));
  });
});

describe("cartoon family once per paper; logic openers rotate (QA 6:53 #3)", () => {
  const cartoonCount = (lines: (string | null)[]) => lines.filter((l) => l && isCartoonJoke(l)).length;
  it("one pool, one line, dealt once per paper", () => {
    expect(CARTOON_FAMILY).toEqual([SIGNATURE_QUIP]);
    expect(STAGE2_QUIPS.filter((q) => isCartoonJoke(q))).toEqual([]);
    for (const seed of ["a", "b", "paper-42", "044f6dc8"]) {
      const dealt = Array.from({ length: 10 }, (_, i) => [quipFor(seed, i, "pick_lead"), quipFor(seed, i, "logic_opener")]).flat();
      const stock = Object.keys(STOCK_POOLS).flatMap((slot) => Array.from({ length: 10 }, (_, i) => (STOCK_POOLS as Record<string, readonly string[]>)[slot]![i % 10] ?? null));
      expect(cartoonCount([...dealt, ...stock, ...WELCOME_BACK_LINES, ...SAMPLE_QUIPS])).toBe(0);
    }
  });
  it("no welcome line, stock line or prompt example calls her a cartoon", () => {
    expect(WELCOME_BACK_LINES.join(" ")).not.toMatch(/cartoon/i);
    expect(Object.values(STOCK_POOLS).flat().join(" ")).not.toMatch(/cartoon/i);
    expect(SAMPLE_QUIPS.join(" ")).not.toMatch(/cartoon/i);
    expect(PAU_PERSONALITY).not.toMatch(/legally a cartoon/i);
    expect(PAU_PERSONALITY).toMatch(/Never call yourself a cartoon/);
  });
  it("model replies drop any cartoon joke", () => {
    expect(oneQuip("Nice. I'd stand up, but I'm a cartoon. What's your claim?")).toBe("Nice. What's your claim?");
  });
  it("'Quick logic check.' is at most one check per paper", () => {
    for (const seed of ["a", "b", "paper-42", "044f6dc8", "x1", "x2"]) {
      const openers = Array.from({ length: 8 }, (_, i) => logicOpenerText(seed, i));
      expect(openers.filter((o) => o.startsWith("Quick logic check.")).length).toBeLessThanOrEqual(1);
      expect(new Set(openers.map((o) => o.split(".")[0])).size).toBe(8);
    }
  });
});
