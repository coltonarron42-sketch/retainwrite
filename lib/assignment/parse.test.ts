import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { coerceRequirements, schemaIssueLog } from "@/lib/assignment/coerce";
import { PARSE_TIMEOUT_MS, parseAssignmentCorpus } from "@/lib/assignment/parse";
import { assignmentRequirementsSchema } from "@/lib/assignment/schema";

const SAMPLE = `SOC 101
Write about how social media affects teen mental health in detail.
Due: May 2, 2026
5 pages, MLA format.
${"detail ".repeat(20)}`;

describe("assignment parse recovery", () => {
  it("coerces loose model JSON and logs issue codes without the payload", () => {
    const coerced = coerceRequirements({
      requirements: {
        topic: "how social media affects teens",
        citationStyle: "APA",
        length: "5 pages",
        aiPolicy: { value: "not allowed", confidence: "80" },
      },
    });
    const parsed = assignmentRequirementsSchema.parse(coerced);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.topic.value).toContain("social media");
    expect(parsed.citationStyle.value).toBe("APA 7");
    expect(parsed.length.value?.pagesMin).toBe(5);
    expect(parsed.aiPolicy.value).toBe("forbidden");
    expect(parsed.aiPolicy.confidence).toBe(0.8);

    const invalid = assignmentRequirementsSchema.safeParse({
      schemaVersion: "nope",
      topic: "my secret essay about shuttle buses",
    });
    expect(invalid.success).toBe(false);
    if (invalid.success) return;
    const issues = schemaIssueLog(invalid.error);
    expect(issues.length).toBeGreaterThan(0);
    expect(JSON.stringify(issues)).not.toContain("shuttle");
    expect(JSON.stringify(issues)).not.toContain("secret");
    expect(issues.every((issue) => issue.path.length < 80 && !issue.code.includes(" "))).toBe(true);
  });

  it("retries the model read up to three times, then the rule parser, and keeps an explicit due date", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let calls = 0;
    const result = await parseAssignmentCorpus(SAMPLE, {
      mode: "live",
      askModel: async () => {
        calls += 1;
        return { ok: true, text: "[]", model: "test" };
      },
    });
    expect(calls).toBe(3);
    expect(result.needsConfirmation).toBe(false);
    expect(result.parseMeta.fallback).toBe(true);
    expect(result.requirements.topic.value).toMatch(/social media/i);
    expect(result.requirements.dueDate.value).toMatch(/May 2, 2026/);
    expect(result.requirements.course.value).toMatch(/SOC/i);
    expect(result.requirements.citationStyle.value).toBe("MLA 9");
    const logged = error.mock.calls.map((call) => JSON.stringify(call));
    expect(logged.join("\n")).not.toContain("social media");
    expect(logged.join("\n")).toContain("schema mismatch");
    error.mockRestore();
  });

  it("asks the student to retype when the model and the rules both find nothing", async () => {
    const bland =
      "Please complete the attached work for class this week and bring questions to the seminar session tomorrow morning with extra notes.";
    const result = await parseAssignmentCorpus(bland, {
      mode: "live",
      askModel: async () => ({ ok: false, reason: "timeout" }),
    });
    expect(result.needsConfirmation).toBe(true);
    expect(result.requirements.topic.value).toBeNull();
    expect(result.requirements.dueDate.value).toBeNull();
    expect(result.parseMeta.reason).toBe("timeout");
  });

  it("rejects a length line as the topic and keeps the real prompt", async () => {
    const corpus = `SOC 101
Argumentative Essay
Write a paper on (1250 words), double spaced, MLA format.
How does social media affect teen mental health?
Use at least 4 scholarly sources.
${"detail ".repeat(12)}`;
    const result = await parseAssignmentCorpus(corpus, {
      mode: "live",
      askModel: async () => ({
        ok: true,
        text: JSON.stringify({
          topic: "1250 words), double spaced, MLA format",
          promptQuestion: "",
          citationStyle: "MLA",
          length: "1250 words",
          course: "SOC 101",
          paperType: "argumentative essay",
        }),
        model: "test",
      }),
    });
    expect(result.requirements.topic.value ?? "").not.toMatch(/1250 words/i);
    expect(result.requirements.topic.value ?? "").not.toMatch(/double spaced/i);
    expect(result.requirements.promptQuestion.value).toMatch(/social media affect teen mental health/i);
    expect(result.requirements.length.value?.wordsMin).toBe(1250);
    expect(result.requirements.citationStyle.value).toBe("MLA 9");
    expect(PARSE_TIMEOUT_MS).toBeLessThanOrEqual(12_000);
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(intake).not.toContain("setTimeout(r, 700)");
    expect(intake).not.toContain('setScreen("followup")');
    expect(intake).toContain("Let's go");
    expect((intake.match(/Looks right/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("retries a failed read at most three times, within the deadline", async () => {
    let calls = 0;
    const started = Date.now();
    const result = await parseAssignmentCorpus(SAMPLE, {
      mode: "live",
      askModel: async () => {
        calls += 1;
        return { ok: false, reason: "timeout" };
      },
    });
    expect(calls).toBe(3);
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(result.parseMeta.reason).toBe("timeout");
    expect(result.requirements.topic.value).toMatch(/social media/i);
  });

  it("hedges the model read and records the elapsed time without the assignment text", () => {
    const parse = readFileSync("lib/assignment/parse.ts", "utf8");
    const route = readFileSync("app/api/papers/[paperId]/assignment/parse/route.ts", "utf8");
    const grok = readFileSync("lib/ai/grok.ts", "utf8");
    const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(parse.match(/void ask\(/g)).toHaveLength(1);
    expect(parse).toContain("PARSE_DEADLINE_MS");
    expect(grok).toContain("controller.abort()");
    expect(grok).toContain("Promise.race");
    expect(route).toContain("[assignment/parse] timing");
    const log = route.slice(route.indexOf("[assignment/parse] timing"), route.indexOf("[assignment/parse] timing") + 240);
    expect(log).toContain("ms:");
    expect(log).not.toMatch(/corpus|rawText/);
    expect(intake).toContain("void fetch(`/api/papers/${paperId}/assignment/finalize`");
    expect(intake).not.toContain("await fetch(`/api/papers/${paperId}/assignment/finalize`");
  });

  it("caps retries at three when the response is not an object", async () => {
    let calls = 0;
    const result = await parseAssignmentCorpus(SAMPLE, {
      mode: "live",
      askModel: async () => {
        calls += 1;
        return { ok: true, text: "[]", model: "test" };
      },
    });
    expect(calls).toBe(3);
    expect(result.parseMeta.fallback).toBe(true);
    expect(result.requirements.topic.value).toMatch(/social media/i);
    expect(result.needsConfirmation).toBe(false);
  });
});
