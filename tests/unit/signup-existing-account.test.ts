import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("signup with an existing email", () => {
  it("tells the student an account exists instead of 'check your email'", () => {
    const actions = readFileSync("app/auth/actions.ts", "utf8");
    expect(actions).toContain("identities?.length");
    expect(actions).toContain("already exists");
    expect(actions).toContain("resetPasswordForEmail");
    expect(actions).toContain("updateUser({ password })");
  });

  it("wires Keep my angle to continueAfterLogic", () => {
    const loop = readFileSync("components/stages/loop/coaching-loop.tsx", "utf8");
    expect(loop).not.toContain('if (choice === "keep") return;');
    expect(loop).toContain('continueAfterLogic("keep")');
  });
});
