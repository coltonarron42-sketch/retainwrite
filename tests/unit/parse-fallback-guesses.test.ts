import { describe, expect, it } from "vitest";
import { parseAssignmentFallback } from "@/lib/assignment/parse-fallback";

const SAMPLE = `SOC 101
Write about how social media affects teen mental health in detail.
Due: May 2, 2026
5 pages, MLA format.`;

describe("parseAssignmentFallback topic and due date", () => {
  it("can guess in demo development", () => {
    const req = parseAssignmentFallback(SAMPLE, { allowTopicAndDueDateGuess: true });
    expect(req.topic.value).toBeTruthy();
    expect(req.dueDate.value).toBeTruthy();
  });

  it("does not fabricate topic or due date when guesses are off", () => {
    const req = parseAssignmentFallback(SAMPLE, { allowTopicAndDueDateGuess: false });
    expect(req.topic.value).toBeNull();
    expect(req.dueDate.value).toBeNull();
    expect(req.course.value).toMatch(/SOC/i);
  });
});
