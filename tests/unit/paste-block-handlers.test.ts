import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Acceptance (e): no paste-blocking preventDefault on intake text fields.
 * File drop-zones may still preventDefault on drag events for uploads.
 */
const ROOTS = ["app", "components"];

function walk(dir: string, out: string[]) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next") continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(path);
  }
}

describe("no paste blocks in intake", () => {
  it("has no onPaste/onDrop preventDefault tied to text fields", () => {
    const files: string[] = [];
    for (const root of ROOTS) walk(join(process.cwd(), root), files);

    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      // PasteBlocked helper or onPaste that preventDefaults
      if (/function\s+PasteBlocked|PasteBlockedTextarea/.test(text)) {
        hits.push(`${file}: PasteBlocked`);
      }
      // onPaste={(e) => { e.preventDefault() }} patterns
      if (/onPaste=\{[^}]*preventDefault/.test(text.replace(/\n/g, " "))) {
        hits.push(`${file}: onPaste preventDefault`);
      }
      // Textarea/Input onDrop that preventDefaults (not file drop zones)
      if (
        /<(?:Textarea|Input)[^>]*onDrop=\{[^}]*preventDefault/.test(
          text.replace(/\n/g, " "),
        )
      ) {
        hits.push(`${file}: Textarea/Input onDrop preventDefault`);
      }
    }
    expect(hits).toEqual([]);
  });
});
