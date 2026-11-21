import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Acceptance (b): banned phrase must not appear in app code, copy, or fixtures.
 * Built from parts so this test file does not match itself.
 * Spec docs under the repo root are skipped.
 */
const BANNED = ["paste", " the ", "prompt", " text"].join("");

const ROOTS = ["app", "components", "lib", "tests", "emails", "scripts"];
const SKIP_DIR = new Set([
  "node_modules",
  ".git",
  ".next",
  "uploads",
]);
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json", ".html"]);

function walk(dir: string, out: string[]) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path, out);
      continue;
    }
    const lower = name.toLowerCase();
    if ([...EXT].some((e) => lower.endsWith(e))) out.push(path);
  }
}

describe("paste is never a gate", () => {
  it(`does not contain “${BANNED}” in app sources`, () => {
    const files: string[] = [];
    for (const root of ROOTS) {
      walk(join(process.cwd(), root), files);
    }
    const hits: string[] = [];
    for (const file of files) {
      if (file.includes(`${join("tests", "unit", "paste-gate")}`)) continue;
      const text = readFileSync(file, "utf8");
      if (text.toLowerCase().includes(BANNED)) {
        hits.push(file.replace(process.cwd() + "/", ""));
      }
    }
    expect(hits).toEqual([]);
  });
});
