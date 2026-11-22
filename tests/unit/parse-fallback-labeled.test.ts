import { describe, expect, it } from "vitest";
import { parseAssignmentCorpus } from "@/lib/assignment/parse";
import { isPlaceholderTopic } from "@/lib/assignment/parse-fallback";

const QA_TXT = `English 101 - Argument Essay
Prompt: Should high schools start later in the morning? Write a 3-page argumentative essay (MLA format, 12 pt Times New Roman, double-spaced) taking a clear position on this question. Use at least three credible sources, including one peer-reviewed study. Address at least one counterargument.
Rubric: Thesis (25 pts), Evidence and sources (30 pts), Counterargument (20 pts), Organization (15 pts), Grammar and MLA format (10 pts).
Sections: Introduction with thesis; Body paragraphs with evidence; Counterargument and rebuttal; Conclusion.
Due: December 5.`;

describe("rule read of a labeled .txt assignment (model timed out)", () => {
  it("fills the confirm card fields that are written in the text", async () => {
    const r = await parseAssignmentCorpus(QA_TXT, {
      mode: "live",
      askModel: async () => ({ ok: false, reason: "timeout" }),
    });
    const q = r.requirements;
    expect(r.needsConfirmation).toBe(false);
    expect(q.course.value).toBe("English 101");
    expect(q.promptQuestion.value).toBe("Should high schools start later in the morning?");
    expect(q.topic.value).not.toBe("this question");
    expect(q.length.value?.pagesMin).toBe(3);
    expect(q.dueDate.value).toBe("December 5");
    expect(q.citationStyle.value).toBe("MLA 9");
    expect(q.requiredSources.value?.countMin).toBe(3);
    expect(q.rubricCriteria.value?.map((c) => c.name)).toEqual([
      "Thesis",
      "Evidence and sources",
      "Counterargument",
      "Organization",
      "Grammar and MLA format",
    ]);
    expect(q.rubricCriteria.value?.[0].weight).toBe(25);
    expect(q.structuralRequirements.value).toHaveLength(4);
  });

  it("treats 'this question' as a pointer, not a topic", () => {
    expect(isPlaceholderTopic("this question")).toBe(true);
    expect(isPlaceholderTopic("high school start times")).toBe(false);
  });

  it("does not invent a due date that is not written", async () => {
    const r = await parseAssignmentCorpus(QA_TXT.replace("Due: December 5.", ""), {
      mode: "live",
      askModel: async () => ({ ok: false, reason: "timeout" }),
    });
    expect(r.requirements.dueDate.value).toBeNull();
  });
});
