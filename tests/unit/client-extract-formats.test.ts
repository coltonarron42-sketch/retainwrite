import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readLegacyDoc, rtfToText } from "@/lib/assignment/client-extract";

describe("rtfToText", () => {
  it("keeps paragraph text and drops font tables", () => {
    const rtf = String.raw`{\rtf1\ansi{\fonttbl{\f0 Times New Roman;}}{\colortbl;\red0\green0\blue0;}\f0 PSYC 101\par Prompt: How has social media changed identity?\par Due date: February 28\par}`;
    const text = rtfToText(rtf);
    expect(text).toContain("PSYC 101");
    expect(text).toContain("Prompt: How has social media changed identity?");
    expect(text).toContain("Due date: February 28");
    expect(text).not.toMatch(/Times New Roman|red0/);
  });
});

const sample = "/workspace/samples/assignment-psych";
describe.runIf(existsSync(`${sample}.rtf`))("sample files", () => {
  it("reads the LibreOffice RTF", () => {
    const text = rtfToText(readFileSync(`${sample}.rtf`, "latin1"));
    expect(text).toContain("Due date: February 28");
  });
  it("reads the Word 97 .doc", () => {
    const text = readLegacyDoc(new Uint8Array(readFileSync(`${sample}.doc`)));
    expect(text).toContain("February 28");
  });
});
