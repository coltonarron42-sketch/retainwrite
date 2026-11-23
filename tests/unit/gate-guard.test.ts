import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { autosaveResumeAllowed, guardStageMove, stageRedirect } from "@/lib/stages/gate-guard";
import { healStuckOutlineSession } from "@/lib/stages/advance";

const prog = [1, 2, 3, 4, 5, 6].map((stage) => ({ stage, status: (stage === 1 ? "complete" : stage === 2 ? "in_progress" : "locked") as "complete" | "in_progress" | "locked" }));
const open = { sections: [{ status: "confirmed" }, { status: "open" }, { status: "open" }] };
const done = { sections: [{ status: "confirmed" }, { status: "skipped" }, { status: "confirmed" }] };

describe("preserved gates: opening a URL never moves a paper", () => {
  it("redirects /stage/3 and /stage/4 on a Stage 2 paper back to Stage 2; earlier stages open", () => {
    expect(stageRedirect(3, 2)).toBe(2);
    expect(stageRedirect(4, 2)).toBe(2);
    expect(stageRedirect(6, 2)).toBe(2);
    expect(stageRedirect(2, 2)).toBeNull();
    expect(stageRedirect(1, 2)).toBeNull();
  });
  it("progress: no skipping ahead, and Stance -> Outline only when every section is confirmed or skipped", () => {
    expect(guardStageMove({ serverStage: 2, requestedStage: 4, progress: prog, session: done })).toEqual({ ok: false, reason: "skip_ahead" });
    expect(guardStageMove({ serverStage: 2, requestedStage: 3, progress: prog, session: open })).toEqual({ ok: false, reason: "stance_open" });
    expect(guardStageMove({ serverStage: 2, requestedStage: 3, progress: prog, session: null })).toEqual({ ok: false, reason: "stance_open" });
    const ok = guardStageMove({ serverStage: 2, requestedStage: 3, progress: prog, session: done });
    expect(ok.ok && ok.currentStage).toBe(3);
    expect(ok.ok && ok.progress.find((r) => r.stage === 4)?.status).toBe("locked");
    expect(guardStageMove({ serverStage: 1, requestedStage: 2, progress: prog, session: null }).ok).toBe(false);
  });
  it("progress: going back never lowers the paper's stage or unlocks later stages", () => {
    const back = guardStageMove({ serverStage: 3, requestedStage: 2, progress: prog.map((r) => ({ ...r, status: "complete" as const })), session: null });
    expect(back.ok && back.currentStage).toBe(3);
    expect(back.ok && back.progress.filter((r) => r.stage > 3).every((r) => r.status === "locked")).toBe(true);
  });
  it("autosave moves the resume pointer only within the current stage", () => {
    expect(autosaveResumeAllowed(3, 2)).toBe(false);
    expect(autosaveResumeAllowed(2, 2)).toBe(true);
    expect(autosaveResumeAllowed(1, 2)).toBe(false);
    const route = readFileSync("app/api/papers/[paperId]/autosave/route.ts", "utf8");
    expect(route).not.toMatch(/current_stage:\s*body/);
  });
  it("the load-path repair uses the paper's stage, not the URL's (no confirm on /stage/3)", () => {
    const sections = [{ status: "open", loopStep: "probe" }, { status: "open", loopStep: "teach" }];
    const viaUrl = healStuckOutlineSession({ currentStage: Math.min(3, 2), progress: prog, sections, resume: null });
    expect(viaUrl.healed).toBe(false);
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    expect(loop).toMatch(/currentStage: Math\.min\(stage, paperStage \?\? stage\)/);
    const page = readFileSync("app/app/papers/[paperId]/stage/[n]/page.tsx", "utf8");
    expect(page).toMatch(/stageRedirect\(stage, loaded\.paper\.current_stage\)/);
  });
});
