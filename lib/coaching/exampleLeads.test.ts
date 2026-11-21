import { describe, expect, it } from "vitest";
import {
  coachingSubject,
  exampleLeadBatch,
  leadCopyIsTemplate,
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
    expect(batch.candidates.some((lead) => lead.name.includes("?"))).toBe(true);
    expect(batch.candidates.some((lead) => /JSTOR|school library/i.test(lead.whyFits))).toBe(true);
    const garbled = exampleLeadBatch({
      concept: "teen sleep and social media",
      assignmentText: "Explain how social media affects teen sleep.",
      studentIdea: "I will restating heavy hurt if the claim is too broad",
      rubricRef: "lesson_concept",
    });
    const garbledText = JSON.stringify(garbled);
    expect(garbledText).not.toMatch(/will restating|heavy hurt/i);
    expect(garbledText).toMatch(/teen sleep|social media/i);
    expect(sourceSearchDirections("teen sleep and social media", "I will restating heavy hurt")).not.toMatch(/heavy hurt/);
    expect(stageLessonHeader("how social media affects teen mental health", "How the assigned concept shows up in the examples you choose")).toMatch(/social media/);
    expect(stageLessonHeader("how social media affects teen mental health", "How the assigned concept shows up in the examples you choose")).not.toMatch(/assigned concept/);
    expect(sourceSearchDirections("teen mental health", "late-night scrolling and sleep")).toMatch(/JSTOR/);
    expect(sourceSearchDirections("teen mental health", "late-night scrolling and sleep")).not.toMatch(/scrolling/);
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
