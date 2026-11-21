import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { draftGuard } from "@/lib/ai/draftGuard";
import {
  composeReadback,
  hiddenDraftPrompt,
  milestoneDecision,
  parseHiddenModel,
  purgeAfter,
  readbackFromSignals,
  runHiddenDraftWithDeps,
  safeHiddenLogDetail,
  type HiddenDraftSignals,
} from "@/lib/drafting/hiddenPlan";

const CANARY = "rwcanaryabc123";

function signals(patch: Partial<HiddenDraftSignals> = {}): HiddenDraftSignals {
  return {
    version: 1,
    ledgerHash: "hash",
    placement: [],
    pacing: [],
    gaps: [],
    order: { suggested: null, confidence: 0 },
    landing: [],
    sentenceWeight: [],
    ...patch,
  };
}

const modelJson = {
  text: {
    sections: [
      {
        sectionKey: "intro",
        paragraphs: [{ text: "Private pacing note about the shuttle at dawn.", usesIdeaIds: ["a"] }],
      },
    ],
  },
  signals: signals({
    placement: [{ ideaId: "b", currentSection: "body", bestSection: "intro", confidence: 0.9 }],
    order: { suggested: ["b", "a"], confidence: 0.8 },
  }),
};

describe("hidden draft plan", () => {
  it("skips a repeat hash and stops at the cap before calling the model", () => {
    expect(milestoneDecision(null, "next")).toEqual({ action: "generate" });
    expect(milestoneDecision({ ledgerHash: "same", generations: 2 }, "same")).toEqual({
      action: "skip",
      status: "unchanged",
    });
    expect(milestoneDecision({ ledgerHash: "old", generations: 15 }, "next")).toEqual({
      action: "skip",
      status: "capped",
    });
  });

  it("purges 30 days after Drafting ends and never later than 90 days", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    expect(purgeAfter(created, null).toISOString()).toBe("2026-04-01T00:00:00.000Z");
    const ended = new Date("2026-03-01T00:00:00Z");
    expect(purgeAfter(created, ended).toISOString()).toBe("2026-03-31T00:00:00.000Z");
    const late = new Date("2026-06-01T00:00:00Z");
    expect(purgeAfter(created, late).toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("stores the canary in the private text and keeps it out of signals", () => {
    const parsed = parseHiddenModel(modelJson, "ledger-hash", CANARY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(JSON.stringify(parsed.storedText)).toContain(CANARY);
    expect(JSON.stringify(parsed.signals)).not.toContain(CANARY);
    expect(parsed.signals.ledgerHash).toBe("ledger-hash");
    expect(JSON.stringify(parsed.signals)).not.toContain("shuttle");
  });

  it("reorders the student's ideas and caps scripted flags at two", () => {
    const shaped = readbackFromSignals({
      ideas: [
        { id: "a", text: "first idea in my words", sectionKey: "body" },
        { id: "b", text: "second idea in my words", sectionKey: "body" },
      ],
      labels: { intro: "Introduction", body: "Body" },
      signals: signals({
        order: { suggested: ["b", "a"], confidence: 0.85 },
        placement: [
          { ideaId: "b", currentSection: "body", bestSection: "intro", confidence: 0.9 },
          { ideaId: "a", currentSection: "body", bestSection: "intro", confidence: 0.4 },
        ],
        sentenceWeight: [
          { sectionKey: "body", planRowId: "6", weight: "heavy" },
          { sectionKey: "body", planRowId: "2", weight: "heavy" },
        ],
      }),
    });
    expect(shaped.ideas.map((idea) => idea.id)).toEqual(["b", "a"]);
    expect(shaped.flags).toHaveLength(2);
    expect(shaped.flags[0]?.text).toBe("This idea might land better in Introduction.");
    expect(shaped.flags.every((flag) => flag.text.includes("first idea") || flag.text.includes("second idea"))).toBe(
      false,
    );
    expect(JSON.stringify(shaped)).not.toContain("shuttle");
    expect(composeReadback({ ideas: shaped.ideas, signals: null, leakOk: false }).flags).toEqual([]);
  });

  it("does not write when generation fails, and the status carries no private text", async () => {
    let wrote = false;
    const failed = await runHiddenDraftWithDeps({
      ledgerHash: "h",
      meta: null,
      canary: CANARY,
      mode: "prose",
      model: async () => ({ ok: false, reason: "timeout" }),
      write: async () => {
        wrote = true;
        return { status: "stored" };
      },
    });
    expect(failed).toEqual({ status: "failed", reason: "timeout" });
    expect(wrote).toBe(false);

    const stored = await runHiddenDraftWithDeps({
      ledgerHash: "h",
      meta: { ledgerHash: "old", generations: 1 },
      canary: CANARY,
      mode: "prose",
      model: async () => ({ ok: true, json: modelJson }),
      write: async (row) => {
        expect(JSON.stringify(row.storedText)).toContain(CANARY);
        expect(JSON.stringify(row.signals)).not.toContain(CANARY);
        return { status: "stored" };
      },
    });
    expect(stored).toEqual({ status: "stored" });
    expect(JSON.stringify(stored)).not.toContain(CANARY);
  });

  it("builds a prompt from the student's ledger and logs only short codes", () => {
    const prompt = hiddenDraftPrompt({
      thesis: "Listening matters",
      storyAngle: "a coach who listened",
      sections: [{ sectionKey: "intro", title: "Introduction", items: [{ id: "a", text: "my idea" }] }],
    });
    expect(prompt.system).toMatch(/never shown/i);
    expect(prompt.user).toContain("my idea");
    expect(prompt.user).not.toContain("hiddenDraft");
    expect(safeHiddenLogDetail({ reason: "missing_key", text: "Private pacing note", canary: CANARY })).toEqual({
      reason: "missing_key",
    });
  });

  it("blocks a canary or a near copy with D9 and leaves ordinary coaching alone", () => {
    expect(
      draftGuard({
        text: `See ${CANARY} in the coach note.`,
        topicStems: ["listening"],
        studentText: "my idea",
        hiddenDraft: "Private pacing note.",
        canary: CANARY,
      }),
    ).toMatchObject({ ok: false, rule: "D9" });
    expect(
      draftGuard({
        text: "Does this example fit the style you picked?",
        topicStems: ["listening"],
        studentText: "my idea",
      }).ok,
    ).toBe(true);
  });

  it("keeps the service-role migration off the exposed API and deletes expired rows", () => {
    const sql = readFileSync("supabase/migrations/0014_hidden_draft_rpc.sql", "utf8");
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/revoke all on function public\.upsert_hidden_draft/);
    expect(sql).toMatch(/from anon/);
    expect(sql).toMatch(/from authenticated/);
    expect(sql).toMatch(/grant execute on function public\.purge_hidden_drafts\(\) to service_role/);
    expect(sql).toMatch(/delete from private\.hidden_drafts/);
    expect(sql).toMatch(/interval '30 days'/);
    expect(sql).toMatch(/interval '90 days'/);
    expect(sql).toMatch(/stays out of Supabase exposed API schemas/);
    expect(sql).toMatch(/grant usage on schema private to service_role/);
    expect(sql).toMatch(/grant select, insert, update, delete on private\.hidden_drafts to service_role/);
    expect(sql).not.toMatch(/grant usage on schema private to (anon|authenticated)/);
    expect(sql).not.toMatch(/on private\.hidden_drafts to (anon|authenticated)/);
    expect(sql).not.toMatch(/pgrst/i);
    const signalsFn = sql.slice(sql.indexOf("function public.get_hidden_draft_signals"), sql.indexOf("function public.load_hidden_draft_guard"));
    expect(signalsFn).not.toMatch(/'canary'|row\.text/);
    const readback = readFileSync("app/api/papers/[paperId]/draft/readback/route.ts", "utf8");
    const milestone = readFileSync("app/api/papers/[paperId]/hidden-draft/route.ts", "utf8");
    const cron = readFileSync("app/api/cron/hidden-draft-purge/route.ts", "utf8");
    expect(readback).not.toMatch(/load_hidden_draft_guard|hiddenDraft/);
    expect(milestone).not.toMatch(/canary|storedText|load_hidden_draft_guard/);
    expect(cron).not.toMatch(/canary|row\.text/);
    expect(readFileSync("eslint.config.mjs", "utf8")).toMatch(/lib\/server\/hiddenDraft/);
    expect(readFileSync("lib/server/readback/index.ts", "utf8")).not.toMatch(/loadHiddenDraftMaterial/);
  });
});
