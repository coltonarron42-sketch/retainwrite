import { describe, expect, it } from "vitest";
import { asHeading, asQuestion, isClauseTopic, isQuestionTopic, topicMidSentence } from "@/lib/copy/topic-phrase";
import { earlyStanceQuestion } from "@/lib/stage1/early-stance";
import { stageLessonHeader } from "@/lib/coaching/exampleLeads";

const Q = "Should high schools start classes later in the morning?";
const QNOQ = "Should high schools start classes later in the morning";
const CLAUSE = "How social media has changed the way teenagers form their sense of identity";

describe("topic phrasing", () => {
  it("tells questions from clauses", () => {
    expect(isQuestionTopic(Q)).toBe(true);
    expect(isQuestionTopic(QNOQ)).toBe(true);
    expect(isQuestionTopic(CLAUSE)).toBe(false);
    expect(isClauseTopic(CLAUSE)).toBe(true);
    expect(isQuestionTopic("How has social media changed identity?")).toBe(true);
  });
  it("never leaves a stray ?. or a capital mid-sentence", () => {
    expect(asQuestion(QNOQ)).toBe(Q);
    expect(asQuestion(`${Q}.`)).toBe(Q);
    expect(topicMidSentence(CLAUSE)).toBe("how social media has changed the way teenagers form their sense of identity");
    expect(topicMidSentence("Later school start times")).toBe("Later school start times");
    expect(asHeading(QNOQ)).toBe(Q);
    expect(asHeading(CLAUSE)).toBe(CLAUSE);
  });
  it("early take question handles question-form topics", () => {
    for (const topic of [Q, QNOQ]) {
      const text = earlyStanceQuestion({ topic });
      expect(text).not.toMatch(/early take on should/i);
      expect(text).not.toMatch(/\?\./);
      expect(text).toBe(`${Q} What's your early take?`);
    }
    expect(earlyStanceQuestion({ topic: CLAUSE })).toBe(
      "What's your early take on how social media has changed the way teenagers form their sense of identity?",
    );
  });
  it("stage 2 heading handles question-form topics", () => {
    const lesson = "How the assigned concept shows up in the examples you choose";
    expect(stageLessonHeader(QNOQ, lesson)).toBe(Q);
    expect(stageLessonHeader(CLAUSE, lesson)).toBe(CLAUSE);
    expect(stageLessonHeader("later school start times", lesson)).toBe(
      "How later school start times shows up in the examples you choose",
    );
  });
});

describe("question topics in Stage 2 templates", () => {
  const q = "Should high schools start later in the morning?";
  it("never splices a question mid-sentence", async () => {
    const { exampleLeadBatch, sourceSearchDirections } = await import("@/lib/coaching/exampleLeads");
    const { askForConcept, defaultTeachCard } = await import("@/lib/coaching/teach");
    const { lessonLinkFor } = await import("@/lib/coaching/sourceCard");
    const batch = exampleLeadBatch({ concept: q, assignmentText: "", studentIdea: "", rubricRef: "r" });
    const all = [
      ...batch.candidates.flatMap((c) => [c.name, c.lessonLink, c.whyFits]),
      batch.wildcard!.name,
      batch.wildcard!.wildcardWhy ?? "",
      askForConcept(q),
      defaultTeachCard(q, "r").definition,
      lessonLinkFor(q),
      sourceSearchDirections(q),
    ].join(" | ");
    expect(all).not.toMatch(/\?”\?|\?\.|about Should|of Should|part of Should|with What/);
    expect(all).toContain("What should you look up first about your question?");
    expect(all).toContain("key words like high schools start later, morning");
    expect(all).not.toMatch(/about high schools start later/);
    expect(askForConcept(q)).toBe("Which part of this question interests you most: “Should high schools start later in the morning?”");
  });
});
