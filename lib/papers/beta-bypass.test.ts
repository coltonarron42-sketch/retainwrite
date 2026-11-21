import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { betaCreditBypass } from "@/lib/papers/beta-bypass";
import { continueHref, DRAFT_SAVE_DELAY_MS } from "@/lib/papers/resume";

describe("beta credit bypass", () => {
  it("stays off unless the server flag and the allowlist both match", () => {
    const env = {
      BETA_BYPASS_CREDITS: "true",
      BETA_BYPASS_EMAILS: "qa@example.com, other@example.com",
    };
    expect(betaCreditBypass("qa@example.com", env)).toBe(true);
    expect(betaCreditBypass("QA@example.com", env)).toBe(true);
    expect(betaCreditBypass("stranger@example.com", env)).toBe(false);
    expect(betaCreditBypass("qa@example.com", { ...env, BETA_BYPASS_CREDITS: "" })).toBe(false);
    expect(betaCreditBypass("qa@example.com", { BETA_BYPASS_CREDITS: "true", BETA_BYPASS_EMAILS: "" })).toBe(false);
  });

  it("is not imported by client screens", () => {
    const signup = readFileSync("components/auth/signup-form.tsx", "utf8");
    const dashboard = readFileSync("components/app/dashboard.tsx", "utf8");
    expect(signup + dashboard).not.toContain("BETA_BYPASS");
  });
});

describe("resume link", () => {
  it("opens the saved stage, section, and question", () => {
    expect(
      continueHref({
        id: "paper-1",
        current_stage: 1,
        resume: { stage: 2, sectionKey: "body", questionId: "probe", screen: "stance" },
      }),
    ).toBe("/app/papers/paper-1/stage/2?section=body&question=probe&screen=stance");
    expect(
      continueHref({
        id: "paper-1",
        current_stage: 3,
        resume: { stage: 2, sectionKey: "conclusion", screen: "stance" },
      }),
    ).toBe("/app/papers/paper-1/stage/3");
    expect(DRAFT_SAVE_DELAY_MS).toBe(2000);
  });
});

describe("autosave migration", () => {
  it("keeps the new table off anon and grants the signed-in role", () => {
    const sql = readFileSync("supabase/migrations/0015_autosave.sql", "utf8");
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/revoke all on table public.paper_autosaves from anon/);
    expect(sql).toMatch(/grant select, insert, update, delete on table public.paper_autosaves to authenticated, service_role/);
    expect(sql).not.toMatch(/grant .+ to anon/i);
  });
});
