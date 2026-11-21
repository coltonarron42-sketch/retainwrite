import { describe, expect, it } from "vitest";
import {
  coachingSubject,
  exampleLeadBatch,
  leadCopyIsTemplate,
  searchKeywords,
  sourceSearchDirections,
  stageLessonHeader,
  visibleSourceLead,
} from "@/lib/coaching/exampleLeads";

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
    expect(names.every((name) => !/^Research on /i.test(name))).toBe(true);
    expect(names.every((name) => !leadCopyIsTemplate(name))).toBe(true);
    expect(searchKeywords("I want to look at late-night scrolling and sleep.", "social media")).toMatch(/scrolling/);
    expect(batch.candidates.some((lead) => /late-night scrolling|scrolling/i.test(`${lead.name} ${lead.whyFits}`))).toBe(true);
    expect(batch.candidates.some((lead) => /JSTOR|school library/i.test(lead.whyFits))).toBe(true);
    expect(batch.candidates.every((lead) => !/paste this sentence|your thesis is/i.test(lead.whyFits))).toBe(true);
    expect(stageLessonHeader("how social media affects teen mental health", "How the assigned concept shows up in the examples you choose")).toMatch(/social media/);
    expect(stageLessonHeader("how social media affects teen mental health", "How the assigned concept shows up in the examples you choose")).not.toMatch(/assigned concept/);
    expect(sourceSearchDirections("teen mental health", "late-night scrolling and sleep")).toMatch(/JSTOR/);
    expect(sourceSearchDirections("teen mental health", "late-night scrolling and sleep")).toMatch(/scrolling/);
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
