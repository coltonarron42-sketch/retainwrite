/**
 * E (PLAN.md 9): Stages 2 and 3 became Pau chat turns. These tests pin the
 * advancement criteria to the old panels (tests/fixtures/coaching-loop-legacy.tsx.txt
 * is the pre-chat component, kept for reference).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keptIdeas, probeForThinNote } from "@/lib/coaching/thin";
import { replaceClaim } from "@/lib/coaching/logicRevision";
import { productStageBounce, sectionContinueTarget } from "@/lib/stages/advance";
import { stage5Locked } from "@/lib/coaching/sectionLoop";
import {
  afterMirror,
  afterProbe,
  appendLines,
  isPlainYes,
  nextOutlineIndex,
  outlineSectionsForContinue,
  stanceTurnFor,
  type StanceTurnKind,
} from "@/lib/stages/stance-turn";
import { stanceTurnParas } from "@/components/stages/loop/stance-chat";
import { outlineAsk } from "@/components/stages/loop/outline-chat";

const read = (p: string) => readFileSync(p, "utf8");
const legacy = read("tests/fixtures/coaching-loop-legacy.tsx.txt");
const loop = read("components/stages/loop/coaching-loop.tsx");
const stance = read("components/stages/loop/stance-chat.tsx");
const outline = read("components/stages/loop/outline-chat.tsx");

/** The old panels' render conditions, copied from the legacy JSX (inStance = stage 2). */
function legacyPanels(s: {
  mode: "lesson" | "memory";
  loopStep: string;
  hasLogic: boolean;
  logicRevealed: boolean;
}, o: { hasCard: boolean; personalized: boolean; hasBatch: boolean }): StanceTurnKind[] {
  const shown: StanceTurnKind[] = [];
  if (s.mode === "lesson" && s.loopStep === "teach" && o.hasCard) shown.push("teach_card");
  if (s.mode === "memory" && s.loopStep === "teach") shown.push("mirror");
  if (s.loopStep === "probe") shown.push("probe");
  if (s.loopStep === "search" && !o.personalized) shown.push("name_lead");
  if (s.loopStep === "search" && o.hasBatch) shown.push("pick_lead");
  if (s.loopStep === "summarize" || s.loopStep === "confirm") shown.push("confirm");
  if (s.loopStep === "logic_check" && s.hasLogic && !s.logicRevealed) shown.push("logic_opener");
  if (s.loopStep === "logic_check" && s.hasLogic && s.logicRevealed) shown.push("logic_result");
  return shown;
}

describe("E gate parity: one old panel ⇔ one Pau turn", () => {
  it("the legacy fixture is the real old component", () => {
    expect(legacy).toContain('inStance && section.loopStep === "search" && !examples?.personalized');
    expect(legacy).toContain('inStance && section.loopStep === "logic_check" && section.logic && !section.logicRevealed');
  });
  it("every section state maps to the same step as before", () => {
    let checked = 0;
    for (const mode of ["lesson", "memory"] as const)
      for (const loopStep of ["teach", "probe", "search", "summarize", "confirm", "logic_check", "confirmed"])
        for (const status of ["open", "confirmed", "skipped", "reopened"])
          for (const hasCard of [true, false])
            for (const personalized of [true, false])
              for (const hasLogic of [true, false])
                for (const logicRevealed of [true, false]) {
                  // The batch only exists when the directions are personalized (same as the old code).
                  const o = { hasCard, personalized, hasBatch: personalized };
                  const old = legacyPanels({ mode, loopStep, hasLogic, logicRevealed }, o);
                  const now = stanceTurnFor({ mode, loopStep, status, hasLogic, logicRevealed }, o);
                  expect(old.length).toBeLessThanOrEqual(1);
                  if (old.length === 1) expect(now).toBe(old[0]);
                  else expect(["none", "locked_in"]).toContain(now);
                  checked++;
                }
    expect(checked).toBe(2 * 7 * 4 * 2 * 2 * 2 * 2);
  });
});

describe("E gate parity: transitions are the old ones", () => {
  const base = { ideas: ["I think later start times help teens sleep more and focus in class"], searchStatus: "required" as const };
  const ideasSamples = ["Sleep debt shows up in grades for first period classes", "idk", "Teens need more sleep than adults do", "good"];
  it("probe save: same ideas and next step as the old inline code", () => {
    for (const idea of ideasSamples)
      for (const replacing of [true, false])
        for (const searchStatus of ["required", "not_needed"] as const) {
          const section = { ...base, searchStatus };
          const oldIdeas = replacing ? replaceClaim(section.ideas, idea) : [...keptIdeas(section.ideas), idea];
          const oldStep = section.searchStatus === "not_needed" ? "summarize" : "search";
          expect(afterProbe(section, idea, replacing)).toEqual({ ideas: oldIdeas, loopStep: oldStep });
        }
  });
  it("mirror save: same ideas, then probe", () => {
    for (const idea of ideasSamples) {
      expect(afterMirror(base, idea)).toEqual({ ideas: [...keptIdeas(base.ideas), idea], loopStep: "probe" });
    }
  });
  it("thin notes still block probe and mirror saves (same probeForThinNote gate)", () => {
    expect(probeForThinNote("idk")).toBeTruthy();
    for (const fn of ["async function onMirrorSave", "async function onProbeSave"]) {
      const body = loop.slice(loop.indexOf(fn), loop.indexOf(fn) + 700);
      expect(body).toMatch(/probeForThinNote\((idea|note)\)[\s\S]*setThinNote\([a-zA-Z]+\);\s*(restore\((idea|note)\);\s*)?return;/);
    }
  });
  it("outline continue: blank or untouched drafts keep the Stance ideas (old onContinue)", () => {
    const sections = [
      { key: "intro", ideas: ["Hook: my first-period class"] },
      { key: "body", ideas: ["Point one"] },
      { key: "conclusion", ideas: [] as string[] },
    ];
    const legacyContinue = (drafts: Record<string, string | undefined>) =>
      sections.map((item) => {
        const text = drafts[item.key]?.trim();
        if (!text || text === keptIdeas(item.ideas).join("\n")) return item;
        return { ...item, ideas: [text] };
      });
    for (const drafts of [{}, { intro: "" }, { intro: "Hook: my first-period class" }, { body: "New line one\nNew line two", conclusion: "Tie back" }]) {
      expect(outlineSectionsForContinue(sections, drafts)).toEqual(legacyContinue(drafts));
    }
    expect(legacy).toContain("if (!text || text === keptIdeas(item.ideas).join(\"\\n\")) return item;");
  });
  it("the stage gates themselves are untouched and still wired", () => {
    expect(sectionContinueTarget([{ status: "confirmed" }, { status: "open" }], 0)).toEqual({ kind: "section", index: 1 });
    expect(sectionContinueTarget([{ status: "confirmed" }, { status: "confirmed" }], 1)).toEqual({ kind: "outline" });
    expect(stage5Locked([{ status: "skipped" }])).toBe(true);
    expect(productStageBounce({ stage: 3, progress: [{ stage: 2, status: "in_progress" }], sections: [{ status: "open" }] })).toBe("stance");
    expect(loop).toContain("const target = sectionContinueTarget(sections, active);");
    expect(loop).toContain('productStageBounce({ stage, progress: stageProgress, sections: session.sections }) === "stay" ? (\n        <OutlineChat');
    // Stage 3 ends exactly like the old Continue: save every outline, then advance.
    const finish = loop.slice(loop.indexOf("async function finishOutline"), loop.indexOf("async function onOutlineSend"));
    expect(finish).toContain("outlineSectionsForContinue(base.sections, outlineDrafts.current)");
    expect(finish).toContain("fieldKey: `outline:${item.key}`");
    expect(finish.indexOf("await persistField")).toBeLessThan(finish.indexOf("await continueProductStage()"));
    expect(finish).toMatch(/if \(!ok\) \{\s*setThinNote\("Couldn't save the outline."\);\s*return;/);
  });
  it("logic choices route as before (keep/continued/pass continue; revise reopens the probe)", () => {
    const body = loop.slice(loop.indexOf("function onLogicResult"), loop.indexOf("function onSkipSection"));
    expect(body).toContain('void continueAfterLogic("pass", more)');
    expect(body).toContain('void continueAfterLogic("continued", more)');
    expect(body).toContain('void continueAfterLogic("keep", more)');
    expect(body).toContain('updateSection(section.key, { loopStep: "probe", logicRevealed: false, logic: null }');
    const opener = loop.slice(loop.indexOf("function onLogicOpener"), loop.indexOf("function onLogicResult"));
    expect(opener).toContain('...(passed ? { status: "confirmed" as const } : {})');
  });
  it("a typed reply only stands in for a choice when it's a plain yes", () => {
    expect(isPlainYes("yes")).toBe(true);
    expect(isPlainYes("Lock it in")).toBe(true);
    expect(isPlainYes("yes but change the lead")).toBe(false);
    expect(stance).toContain("setHint(TAP_HINT);");
  });
});

describe("E: chat model, persistence and the student's words", () => {
  it("Stage 2 and 3 render as Pau chats with the shared composer, voice header and slim row", () => {
    expect(loop).toContain("<StanceChat");
    expect(loop).toContain("<OutlineChat");
    for (const src of [stance, outline]) {
      expect(src).toContain("<ChatHeader");
      expect(src).toContain("<ChatComposer");
      expect(src).toContain("<ComposerDock>");
      expect(src).toContain("<SpeakNew");
      expect(src.match(/<PauPauGroup/g)!.length).toBeGreaterThanOrEqual(2);
    }
    expect(read("components/stages/stage-shell.tsx")).toContain("stage <= 3 ?");
    expect(loop).not.toContain("<TeachCardView");
    expect(loop).not.toContain("<LogicCheckpoint");
    expect(loop).not.toContain("title=\"Outline\"");
  });
  it("Stage 3 asks one section at a time and the box starts with the student's own Stance notes", () => {
    expect(nextOutlineIndex([{ key: "a" }, { key: "b" }, { key: "c" }], ["a"])).toBe(1);
    expect(nextOutlineIndex([{ key: "a" }], ["a"])).toBe(-1);
    expect(outline).toContain("const notes = current ? keptIdeas(current.ideas).join(\"\\n\") : \"\";");
    const ask = outlineAsk({ key: "intro", title: "Introduction", needs: "Introduce the work", ideas: ["My own note"] }, true).join(" ");
    expect(ask).not.toContain("My own note");
  });
  it("Pau never fills the box with her own text (only the student's notes)", () => {
    const sets = [...loop.matchAll(/setIdea\((.*)\);/g)].map((m) => m[1]);
    expect(sets.length).toBeGreaterThan(3);
    for (const arg of sets) expect(arg).toMatch(/^(""|value|\(cur\) => \(cur\.trim\(\) === sent\.trim\(\) \? "" : cur\)|\(cur\) => \(cur\.trim\(\) \? cur : sent\)|\(cur\) => \(cur\.trim\(\) \? cur : unsent\)|keptIdeas\(section\.ideas\)\.at\(-1\) \?\? ""|revisionPrefill\(section\.ideas\))$/);
  });
  it("voice reads only Pau's words (lead names and the student's notes are not spoken)", () => {
    const section = { key: "body", title: "Body", needs: "x", mode: "lesson" as const, status: "open", concept: null, teachAspect: null, chosenLead: "Dr. Mary Carskadon", logic: null };
    const lead = stanceTurnParas("pick_lead", { section, card: null, mirrorAsk: "", activeTrigger: null }).join(" ");
    const confirm = stanceTurnParas("confirm", { section, card: null, mirrorAsk: "", activeTrigger: null }).join(" ");
    expect(lead + confirm).not.toContain("Carskadon");
  });
  it("the conversation is kept on the saved session so a reload rebuilds it", () => {
    expect(appendLines(undefined, [{ k: "a", who: "pau", text: "Q" }, { k: "a", who: "you", text: " " }])).toHaveLength(1);
    expect(appendLines(Array.from({ length: 90 }, (_, i) => ({ k: "a", who: "you" as const, text: `${i}` })), [])).toHaveLength(80);
    const probe = loop.slice(loop.indexOf("async function onProbeSave"), loop.indexOf("function onNameLead"));
    expect(probe).toMatch(/const nextSession: Session = \{\s*\.\.\.session,\s*transcript,/);
    expect(loop).toContain("transcript={session.transcript ?? []}");
    expect(loop).toContain("outlineTranscript: appendLines(session.outlineTranscript, more)");
    // Stance taps (teach pick, lead pick, lock-in, logic) save the session too, in order, before any later save.
    const upd = loop.slice(loop.indexOf("function updateSection"), loop.indexOf("function log("));
    expect(upd).toContain("syncSession(next, key);");
    expect(loop).toMatch(/function syncSession[\s\S]*?if \(!persist \|\| stage !== 2\) return;[\s\S]*?syncChain\.current = syncChain\.current\.then/);
    expect(loop.match(/await syncChain\.current;/g)!.length).toBeGreaterThanOrEqual(2);
  });
});
