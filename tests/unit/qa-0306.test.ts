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
    expect(composer).toContain("if (!sending || queueWhileSending) onChange(e.target.value);");
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
