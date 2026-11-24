import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { northstarGateFrom } from "@/lib/stage1/intake-resume";
import { wellKnownWork } from "@/lib/stage1/well-known";
import { summaryParas } from "@/lib/stage1/paper-context";
import { informedAffirm, lockedPicks } from "@/lib/stage1/north-turns";

const intake = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
const composer = readFileSync("components/stages/stage1/chat-composer.tsx", "utf8");

describe("QA 3:06 #1 BLOCKER: the informed lock-in and the gate read one source", () => {
  const early =
    "I think transformational leadership works best when a team goes through change, because the leader gets people to believe in where they're going instead of just giving orders. I'd use Satya Nadella at Microsoft as my example.";
  it("a locked-in pick plus a 25+ word early take is a decision with a reason", () => {
    const g = northstarGateFrom({
      answers: [{ questionId: "stance_early", answerText: early }],
      decisionAnswer: "transformational leadership, using Satya Nadella",
      needsLeader: true,
    });
    expect(g.decided).toBe(true);
  });
  it("a pick with no reason yet is not decided (the gate names it)", () => {
    expect(northstarGateFrom({ answers: [], decisionAnswer: "transformational leadership", needsLeader: false }).decided).toBe(false);
  });
  it("the gate reads the locked-in words when no decision was saved, and the lock-in saves the decision with its reason", () => {
    expect(intake).toContain("decisionAnswer: brief.decision?.answer || lockedInStance || null");
    expect(intake).toContain("const base = d?.answer || lockedInStance || \"\";");
    expect(intake).toContain("One thing before the stance interview: what's your main reason that's the right call for this assignment?");
  });
});

describe("QA 3:06 #2: rapid sends never lose text", () => {
  it("typing stays open while a reply is in flight; Enter queues, shown in the chat, sent after the reply", () => {
    expect(composer).toContain("if (value.trim()) onQueue?.();");
    expect(composer).toContain("onChange={(e) => onChange(e.target.value)}");
    expect(intake).toContain("onQueue={() => send()}");
    expect(intake).toContain("data-queued-said");
    expect(intake).toContain("setTimeout(() => latestSendNow.current?.(merged, true), 60);");
  });
  it("a short early take keeps what was already sent and adds the next line", () => {
    expect(intake).toContain("const prevShort = error && shortEcho ? shortEcho : \"\";");
    expect(intake).toContain("if (fromBox && rejectedRef.current && text && !stanceMode) setDraftAnswer(");
  });
  it("the typing hint never stands in for Pau Pau's reply", () => {
    expect(intake).toContain("const hintQuiet = Boolean(error) || submitting || Boolean(pendingSaid) || Boolean(queuedSaid);");
  });
});

describe("QA 3:06 #3: standard texts get general background, never 'won't guess'", () => {
  it("Myers' Psychology, memory chapter: the key concepts", () => {
    const w = wellKnownWork("Chapter 6 of Myers' Psychology (memory)");
    expect(w).not.toBeNull();
    const t = w!.points.join(" ");
    for (const k of ["encoding", "storage", "retrieval", "Atkinson–Shiffrin", "serial position"]) expect(t).toContain(k);
    expect(wellKnownWork("Myers, Psychology, 13th ed., Chapter 6", "write about stress and memory")!.id).toBe("intro-psych-memory");
  });
  it("an unverifiable course-packet article is still not 'known'", () => {
    expect(wellKnownWork("\"Memory Under Pressure\" by L. Tenhagen (2024, course packet only)", "stress helps or hurts memory")).toBeNull();
  });
  it("the label says general background, editions differ, and offers an upload", () => {
    const lead = summaryParas({ kind: "knowledge", title: "Myers' Psychology", points: ["a", "b"], sources: [], at: 0 })[0]!;
    expect(lead).toMatch(/general background/);
    expect(lead).toMatch(/Editions can differ/);
    expect(lead).toMatch(/upload the pages \(photos or a PDF\)/);
  });
});

describe("QA 3:06 #3 titles", () => {
  it("a chapter of a possessive-titled book is named by the book, not the topic", async () => {
    const { shortWork } = await import("@/lib/server/paper-context/brief");
    expect(shortWork("Chapter 6 (Memory) in Myers' Psychology, 13th edition")).toBe("Myers' Psychology, Ch. 6");
  });
});

describe("QA 3:06 minors", () => {
  it("'Locked in' quotes the key picks only", () => {
    expect(lockedPicks("I want to use Sam Walton. I think he shows servant and transformational leadership", "Sam Walton", ["servant", "transformational"])).toBe(
      "Sam Walton, servant and transformational leadership",
    );
    const a = informedAffirm("I want to use Sam Walton. I think he shows servant and transformational leadership, I just want to make sure I hit every requirement.", { leader: "Sam Walton" }).join(" ");
    expect(a).not.toContain("I just want to make sure");
  });
  it("the lost transcript stays in order after the catch-up offer", () => {
    expect(intake).toContain("data-past-aside");
    expect(intake).toContain("setOfferReply((p) => ({ ...p, [qid]: reply }))");
  });
});

describe("QA 3:51", () => {
  it("the textarea is never read-only or disabled, and typing is never ignored", () => {
    expect(composer).toContain("readOnly={false}");
    expect(composer).not.toMatch(/if \(!sending[^)]*\) onChange/);
    expect(composer).not.toContain("data-composer-locked");
    expect(intake).not.toContain("readOnly: restoringDraft");
  });
  it("text typed mid-switch moves with the box (answer box <-> story box)", () => {
    expect(intake).toContain("setOwnStory(draftAnswer);");
    expect(intake).toContain('latestSendNow.current = screen === "story" ? (t: string) => void submitOwnStory(t) : sendNow;');
  });
});

import { titlesInText } from "@/lib/stage1/readings";
import { generalOptionsFor, cleanOptions } from "@/lib/stage1/paper-context";
import { stage2Earlier, smoothCause } from "@/lib/stages/stage2-intro";
describe("QA 3:51 Myers path and nits", () => {
  const sheet = "PSY 101 paper for Dr. Reyes: Using Chapter 6 of Myers' Psychology (memory), write 1,000 words explaining how the serial position effect could help a student study for finals. APA. Due Dec 12.";
  it("an unquoted textbook chapter is a named work, and it's the known memory entry", () => {
    const w = titlesInText(sheet);
    expect(w).toEqual(["Chapter 6 of Myers' Psychology (memory)"]);
    expect(wellKnownWork(w[0]!, sheet)?.id).toBe("intro-psych-memory");
  });
  it("serial position options are its own parts, capitalized; model labels are capitalized", () => {
    const o = generalOptionsFor(sheet)!;
    expect(o.options.map((x) => x.label)).toEqual(["Primacy effect", "Recency effect", "Both: many short sessions"]);
    expect(cleanOptions([{ label: "spacing effect", why: "x" }])[0]!.label).toBe("Spacing effect");
  });
  it("the Stage 2 recap joins a follow-on effect smoothly", () => {
    expect(smoothCause("he sold a shared vision.\nBecause of that Microsoft started working together more, and that matters because it shows X.")).toBe(
      "he sold a shared vision, and as a result, Microsoft started working together more",
    );
    expect(stage2Earlier({ question: "q", pick: "Transformational", answer: "I want transformational leadership because he sold a shared vision.\nBecause of that Microsoft started working together more.", at: 0, source: "stated" } as never)).toContain(
      "because he sold a shared vision, and as a result, Microsoft started working together more.",
    );
  });
  it("a 15+ word reason with a causal link counts as the early take, joined with their pick", () => {
    expect(intake).toContain("if (wordCount(t) < 15 || !CAUSAL_LINK.test(t)) return null;");
  });
});

describe("QA 3:51 React #185", () => {
  it("the reading bubble's clock starts once; a new startedAt each render never restarts it", () => {
    const bubbles = readFileSync("components/stages/stage1/chat-bubbles.tsx", "utf8");
    expect(bubbles).toContain("const [since] = useState(startedAt);");
    expect(bubbles).toContain("const seconds = useElapsed(since);");
  });
});
