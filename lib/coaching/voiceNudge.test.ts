import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { VoiceNudge } from "@/components/coaching/voice-nudge";
import { LogicCheckpoint } from "@/components/coaching/logic-checkpoint";
import { MemoryTriggerList } from "@/components/coaching/memory-triggers";
import {
  checklistItem5Resolved,
  describeTell,
  VOICE_NUDGE_EVENTS,
  VOICE_NUDGE_HEADLINE,
  VOICE_NUDGE_KEEP,
  VOICE_NUDGE_MAKE,
  voiceNudgeTips,
} from "@/lib/coaching/voiceNudge";
import { LOGIC_ALERT_LABEL, LOGIC_STRONG_HEADLINE } from "@/lib/coaching/logicCheck";
import type { MismatchResult } from "@/lib/style/mismatch";
import { voiceNudgeStats } from "@/lib/coaching/sop";
import { triggersForStudent } from "@/lib/coaching/memoryTriggers";

const ROOTS = ["app", "components", "lib"];
const SKIP = new Set(["node_modules", ".git", ".next"]);

function walk(dir: string, out: string[]) {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
}

describe("gentle voice nudge (t48)", () => {
  const result: MismatchResult = {
    triggered: true,
    tells: [
      {
        signal: "sentence_length",
        sampleValue: 14,
        draftValue: 32,
        level: "strong",
      },
      {
        signal: "unseen_vocab",
        sampleValue: 0,
        draftValue: 22,
        level: "strong",
      },
    ],
    examples: ["multifaceted", "meticulous"],
  };

  it("names the tells and retires the old check-in", () => {
    expect(describeTell(result.tells[0]!, [])).toBe(
      "sentences here average 32 words; yours usually run about 14",
    );
    expect(describeTell(result.tells[1]!, result.examples)).toMatch(/multifaceted/);
    const html = renderToStaticMarkup(
      createElement(VoiceNudge, { result, section: "body", onKeep: () => {}, onRework: () => {} }),
    );
    expect(html).toContain(VOICE_NUDGE_HEADLINE);
    expect(html).toContain("What we noticed");
    expect(html).toContain(VOICE_NUDGE_MAKE);
    expect(html).toContain(VOICE_NUDGE_KEEP);
    expect(html).not.toMatch(/amber|⚠/);
    const tips = voiceNudgeTips(result);
    expect(tips.length).toBeLessThanOrEqual(3);
    expect(tips.join(" ")).not.toMatch(/you could write|for example:/i);
  });

  it("resolves checklist item 5 when the student keeps their words", () => {
    expect(
      checklistItem5Resolved({ triggered: true, kept: true, revisionSavedAfterRework: false }),
    ).toBe(true);
    expect(VOICE_NUDGE_EVENTS.kept).toBe("voice_nudge_kept");
    const stats = voiceNudgeStats([
      { event: "revision_saved" },
      { event: "voice_nudge_shown" },
      { event: "voice_nudge_kept" },
    ]);
    expect(stats.kept).toBe(1);
    expect(stats.nudgeRate).toBe(1);
  });

  it("keeps retired wording and events out of app code", () => {
    const retired = [
      ["I", "'ve reworked it"].join(""),
      ["This is ", "my writing"].join(""),
      ["I reworked ", "these"].join(""),
      ["it", "'s my writing"].join(""),
      ["This reads differently ", "from your sample"].join(""),
      ["mismatch_", "warned"].join(""),
      ["mismatch_", "response"].join(""),
      ["VOICE_NOTE_ANSWERS_", "ALL"].join(""),
      ["VOICE_", "ALL_PASTED_SHARE"].join(""),
    ];
    const files: string[] = [];
    for (const root of ROOTS) walk(join(process.cwd(), root), files);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const phrase of retired) {
        if (text.includes(phrase)) hits.push(`${file}: ${phrase}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("logic and memory UI copy", () => {
  it("shows the red-alert label and Continue anyway", () => {
    const html = renderToStaticMarkup(
      createElement(LogicCheckpoint, {
        phase: "strong",
        reason: "The claim conflicts with the assignment's ethical standard.",
        assignmentQuote: "ethical principles",
        questions: ["What ethical principle does this claim fail to meet?"],
        onContinue: () => {},
        onChoice: () => {},
      }),
    );
    expect(html).toContain(LOGIC_STRONG_HEADLINE);
    expect(html).toContain(LOGIC_ALERT_LABEL);
    expect(html).toContain("Continue anyway");
    expect(html).toContain("Logic alert");
  });

  it("gives every memory chip a Not this one action", () => {
    const html = renderToStaticMarkup(
      createElement(MemoryTriggerList, {
        triggers: triggersForStudent({ under18: false }),
        onPick: () => {},
        onHide: () => {},
        onSkip: () => {},
      }),
    );
    expect(html).toContain("Not this one");
    expect(html).toContain("Skip these");
  });
});
