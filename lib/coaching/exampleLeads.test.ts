import { describe, expect, it } from "vitest";
import { coachingSubject, exampleLeadBatch, leadCopyIsTemplate, visibleSourceLead } from "@/lib/coaching/exampleLeads";

describe("exampleLeadBatch", () => {
  it("names this assignment instead of generic template slots", () => {
    const batch = exampleLeadBatch({
      concept: null,
      assignmentText: "Explain how social media affects teen mental health. Use scholarly sources.",
      studentIdea: "I want to look at late-night scrolling and sleep.",
      rubricRef: "lesson_concept",
    });
    expect(batch.personalized).toBe(true);
    const names = [...batch.candidates.map((lead) => lead.name), batch.wildcard?.name ?? ""];
    expect(names.some((name) => /social media affects teen mental health/i.test(name))).toBe(true);
    expect(names.every((name) => !leadCopyIsTemplate(name))).toBe(true);
    expect(batch.candidates.some((lead) => /late-night scrolling/i.test(lead.whyFits))).toBe(true);
  });

  it("asks the student to name a source when nothing in the assignment is usable", () => {
    const batch = exampleLeadBatch({
      concept: "the concept",
      assignmentText: "Hi",
      studentIdea: "ok",
      rubricRef: "lesson_concept",
    });
    expect(batch.personalized).toBe(false);
    expect(
      coachingSubject({
        confirmedTopic: "how social media affects teen mental health",
        assignmentText: "SOC 101 Argumentative Essay",
        concept: "the assigned concept",
      }),
    ).toMatch(/social media/i);
    expect(
      coachingSubject({
        assignmentText: "SOC 101 Argumentative Essay",
        concept: "the assigned concept",
      }),
    ).toBe("your topic");
    expect(visibleSourceLead("Research on SOC 101 Argumentative Essay")).toBeNull();
    expect(visibleSourceLead("A study of teen sleep and social media")).toMatch(/teen sleep/);
    expect(batch.candidates).toEqual([]);
  });
});
