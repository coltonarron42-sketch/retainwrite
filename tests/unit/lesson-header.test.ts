import { describe, expect, it } from "vitest";
import { extractLesson, fallbackLesson, guardLesson } from "@/lib/coaching/lesson";
import { lessonStatementUsable, stageLessonHeader } from "@/lib/coaching/exampleLeads";

const QA = `ENG 101: College Composition
Department of English  ·  Fall 2026
Instructor: Prof. Dana Ruiz
Argumentative Essay
Due date: December 12, 2026
Length: 1,200–1,500 words
Citation style: MLA 9 (MLA Handbook, 9th edition)
Topic
Should high schools start later in the morning?
Prompt question
Should U.S. high schools delay start times to 8:30 AM or later?
Assignment
Write an argumentative essay that takes a clear, defensible position on the prompt. Your thesis should appear in the introduction and guide the rest of the paper.`;

describe("Stage 2 heading on the QA sheet", () => {
  it("the lesson is not thrown to the fallback, and its quote stays verbatim", () => {
    const res = extractLesson(QA);
    expect(guardLesson(res.lesson, QA).ok).toBe(true);
    expect(res.lesson.evidence.quote).not.toMatch(/…/);
    expect(res.lesson.evidence.quote).toBe("Should high schools start later in the morning?");
  });

  it("never shows the course header as the heading", () => {
    const fb = fallbackLesson(QA);
    expect(fb.lesson.statement).not.toMatch(/Instructor|Department of English/);
    const header = "ENG 101: College Composition Department of English · Fall 2026 Instructor: Prof. Dana Ruiz Argumentative Essay Due date: December 12, 2026 Length: 1,200–1,500 words Citation style: MLA 9 (MLA…";
    expect(lessonStatementUsable(header)).toBe(false);
    expect(stageLessonHeader("Should high schools start later in the morning?", header)).toBe("Should high schools start later in the morning?");
    expect(stageLessonHeader("your topic", header)).toBe("What this assignment is asking you to learn");
  });
});
