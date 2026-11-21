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

  it("reads an explicit due date and does not invent one when the text has none", () => {
    const req = parseAssignmentFallback(SAMPLE, { allowTopicAndDueDateGuess: false });
    expect(req.topic.value).toMatch(/social media/i);
    expect(req.dueDate.value).toMatch(/May 2, 2026/);
    expect(req.course.value).toMatch(/SOC/i);
    const undated = parseAssignmentFallback(
      "Write about how social media affects teen mental health in a short essay for class.",
      { allowTopicAndDueDateGuess: false },
    );
    expect(undated.dueDate.value).toBeNull();
  });

  it("reads length, type, and sources from an argumentative assignment", () => {
    const req = parseAssignmentFallback(
      `SOC 101\nArgumentative Essay\nWrite a 5-7 page argumentative essay about how social media affects teen mental health.\nUse at least 4 scholarly sources.\nMLA format.`,
      { allowTopicAndDueDateGuess: false },
    );
    expect(req.topic.value).toMatch(/social media/i);
    expect(req.paperType.value).toMatch(/argumentative/i);
    expect(req.length.value?.pagesMin).toBe(5);
    expect(req.requiredSources.value?.countMin).toBe(4);
    expect(req.dueDate.value).toBeNull();
  });
});
