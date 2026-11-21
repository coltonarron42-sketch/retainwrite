import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("stage progress save", () => {
  it("waits for the server unlock before opening the next stage", () => {
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    const shell = readFileSync("components/stages/stage-shell.tsx", "utf8");
    const save = loop.indexOf("await onStageProgress");
    const navigate = loop.indexOf("router.push(`/app/papers/${paperId}/stage/${nextStage}`)");
    expect(save).toBeGreaterThan(-1);
    expect(navigate).toBeGreaterThan(save);
    expect(shell).toContain("await fetch(`/api/papers/${paperId}/progress`");
    expect(shell).not.toContain("void fetch(`/api/papers/${paperId}/progress`");
  });
});
