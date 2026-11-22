import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("edited answers", () => {
  it("the answers route returns only the latest answer per question", () => {
    const route = readFileSync("app/api/papers/[paperId]/intake/answers/route.ts", "utf8");
    expect(route).toContain('.order("created_at", { ascending: true })');
    expect(route).toContain("latest.set(row.question_id, row);");
  });
});
