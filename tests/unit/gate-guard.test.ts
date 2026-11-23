import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { autosaveResumeAllowed, guardStageMove, intakeCompleteAllowed, SOFT_GATE_DEFAULT, SOFT_GATE_STAGE3, softGateMessage, stageView } from "@/lib/stages/gate-guard";
import { healStuckOutlineSession } from "@/lib/stages/advance";

const prog = [1, 2, 3, 4, 5, 6].map((stage) => ({ stage, status: (stage === 1 ? "complete" : stage === 2 ? "in_progress" : "locked") as "complete" | "in_progress" | "locked" }));
const open = { sections: [{ status: "confirmed" }, { status: "open" }, { status: "open" }] };
const done = { sections: [{ status: "confirmed" }, { status: "skipped" }, { status: "confirmed" }] };

describe("preserved gates: opening a URL never moves a paper", () => {
  it("past stages are review, the paper's stage is live, later stages are a soft gate (no redirect)", () => {
    expect(stageView(1, 2)).toBe("review");
    expect(stageView(2, 2)).toBe("current");
    expect(stageView(3, 2)).toBe("ahead");
    expect(stageView(4, 2)).toBe("ahead");
    expect(stageView(2, 4)).toBe("review");
    expect(softGateMessage(3)).toBe(SOFT_GATE_STAGE3);
    expect(softGateMessage(4)).toBe(SOFT_GATE_DEFAULT);
    expect(SOFT_GATE_DEFAULT).toBe("We need a bit more info from an earlier stage before we can start building here.");
    expect(SOFT_GATE_STAGE3).toMatch(/^In this stage we really start putting the whole project together\. Get your Stage 2 info in/);
  });
  it("the shell: soft gate mounts no live stage (nothing can write), review is inert with a way back", () => {
    const shell = readFileSync("components/stages/stage-shell.tsx", "utf8");
    const ahead = shell.slice(shell.indexOf('if (view === "ahead")'), shell.indexOf('const review = view === "review"'));
    expect(ahead).toMatch(/softGateMessage\(stage\)/);
    expect(ahead).toMatch(/backLabel/);
    expect(ahead).not.toMatch(/<CoachingLoop|<AssignmentIntake/);
    expect(shell).toMatch(/disabled=\{review\}/);
    expect(shell).not.toMatch(/Stage locked/);
    const page = readFileSync("app/app/papers/[paperId]/stage/[n]/page.tsx", "utf8");
    expect(page).not.toMatch(/redirect\(/);
  });
  it("intake complete never re-runs a finished Stage 1 or rewinds a later paper", () => {
    expect(intakeCompleteAllowed(1)).toBe(true);
    expect(intakeCompleteAllowed(2)).toBe(false);
    expect(intakeCompleteAllowed(4)).toBe(false);
    const route = readFileSync("app/api/papers/[paperId]/intake/complete/route.ts", "utf8");
    expect(route.indexOf("intakeCompleteAllowed(")).toBeLessThan(route.indexOf('.update({ current_stage: 2'));
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
  });
});
