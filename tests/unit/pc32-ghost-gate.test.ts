/**
 * PC-32 QA 5:15 PM: the ghost gate blocks real leakage, not generic wording.
 * Distinctive runs only; block on any 8-word run or 2+ distinct 5-word runs; one retry in other
 * words before the fallback.
 */
import { describe, expect, it, vi } from "vitest";
import { ghostLeakCheck, sealGhost, type GhostScript } from "@/lib/ghost/script";

const GHOST: GhostScript = {
  v: 1,
  inputHash: "h",
  thesis: "Sam Walton's servant leadership carried Walmart through rapid change because he kept asking store associates what was getting in their way.",
  outline: [
    { section: "Introduction", points: ["define servant leadership", "Walton as the example"] },
    { section: "Body 1", points: ["Saturday morning meetings", "profit sharing for associates"] },
  ],
  paper: [
    "Leadership styles differ in where they put the leader's attention.",
    "Transformational leaders inspire people with a shared vision of the future, while servant leadership puts the needs of the team first.",
    "Sam Walton's servant leadership carried Walmart through rapid change because he kept asking store associates what was getting in their way.",
    "At the Saturday morning meetings in Bentonville, Walton would quiz managers about which shelves had sat empty that week and who had noticed first.",
    "When Walmart introduced profit sharing for hourly associates in 1971, turnover in the distribution centers dropped within two years.",
    "Transactional leadership, by contrast, relies on rewards and clear goals, and situational leadership adapts to the people and the moment.",
  ].join(" "),
  sources: [{ title: "Made in America", url: "https://example.com/made-in-america" }],
  startingKind: "has_ideas",
  at: 1,
  searches: 3,
};
const ASSIGNMENT = "Write a 1,200-1,500 word essay that argues which leadership style is most effective for leading a team through change, using one real leader as your example.";

describe("ghost gate: distinctive runs only (QA 5:15 PM)", () => {
  it("a plain answer to 'What are the main leadership styles?' passes", () => {
    const answer = [
      "The main leadership styles you'll see in your readings are transformational, servant, transactional and situational.",
      "Transformational leaders inspire people with a shared vision of the future, while servant leadership puts the needs of the team first.",
      "Transactional leadership relies on rewards and clear goals, and situational leadership adapts to the people and the moment.",
      "Which one fits the leader you have in mind?",
    ];
    for (const p of answer) expect(ghostLeakCheck(p, GHOST, ASSIGNMENT), p).toMatchObject({ ok: true });
  });
  it("a pasted ghost sentence is still blocked (8-word run)", () => {
    const r = ghostLeakCheck(`Here's a strong line: ${GHOST.thesis}`, GHOST, ASSIGNMENT);
    expect(r.ok).toBe(false);
    expect(r.rule).toBe("ngram8");
    expect(r.hits8).toBeGreaterThan(0);
  });
  it("two distinct distinctive 5-word runs block; a single one doesn't", () => {
    const one = ghostLeakCheck("You could look at the Saturday morning meetings in Bentonville as a moment to study.", GHOST, ASSIGNMENT);
    expect(one).toMatchObject({ ok: true, hits5: 1 });
    const two = ghostLeakCheck("Think about the Saturday morning meetings in Bentonville, and profit sharing for hourly associates in 1971.", GHOST, ASSIGNMENT);
    expect(two.ok).toBe(false);
    expect(two.rule).toBe("ngram5");
    expect(two.hits5).toBeGreaterThanOrEqual(2);
  });
  it("overlap with the student's own words, the assignment or the readings never counts", () => {
    const student = "I want to write about Sam Walton's servant leadership carried Walmart through rapid change because he kept asking store associates";
    expect(ghostLeakCheck("You said Sam Walton's servant leadership carried Walmart through rapid change because he kept asking store associates. Nice.", GHOST, student).ok).toBe(true);
    const reading = "Made in America: at the Saturday morning meetings in Bentonville, Walton would quiz managers about which shelves had sat empty";
    expect(ghostLeakCheck("Your reading says that at the Saturday morning meetings in Bentonville, Walton would quiz managers about which shelves had sat empty.", GHOST, reading).ok).toBe(true);
  });
});

// Route: the first draft pastes the ghost, the retry answers in other words (logged both).
const SECRET = "gate-test-secret";
const PAPER_ID = "33333333-3333-4333-8333-333333333333";
const drafts: string[][] = [];
vi.mock("server-only", () => ({}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => undefined }));
vi.mock("@/lib/env", async (orig) => ({ ...(await orig<typeof import("@/lib/env")>()), hasSupabaseConfig: () => true }));
vi.mock("@/lib/demo/session-server", () => ({ getDemoSession: async () => null }));
vi.mock("@/lib/server/paper-context/store", () => ({ loadPaperContextBlock: async () => ({ block: ASSIGNMENT }), readPaperContext: async () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u" } }, error: null }) },
    from: (name: string) => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: name === "papers" ? { id: PAPER_ID } : { draft_text: sealGhost(GHOST, SECRET) }, error: null }),
      };
      return q;
    },
  }),
}));
vi.mock("@/lib/ai/grok", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/grok")>()),
  grokChatJson: async () => ({ ok: true, model: "m", text: JSON.stringify({ paras: drafts.shift() ?? [] }) }),
}));

describe("coach/answer: one retry in different words before the fallback", () => {
  const call = async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
    const { POST } = await import("@/app/api/papers/[paperId]/coach/answer/route");
    const req = new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "answer", message: "What are the main leadership styles?", stage: 2 }) });
    return (await (await POST(req, { params: Promise.resolve({ paperId: PAPER_ID }) })).json()) as { paras: string[] };
  };
  it("blocked first draft → the retry's clean answer is shown", async () => {
    drafts.push([`Try this: ${GHOST.thesis}`], ["Servant leaders put their team first; transformational leaders sell a big shared vision. Which feels closer to your leader?"]);
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const r = await call();
    expect(r.paras).toEqual(["Servant leaders put their team first; transformational leaders sell a big shared vision. Which feels closer to your leader?"]);
    const line = log.mock.calls.find((c) => c[0] === "[coach-answer]")![1] as { ghostBlocked: boolean; gate: { rule: string }; regen: { ok: boolean } };
    expect(line.ghostBlocked).toBe(true);
    expect(line.gate.rule).toBe("ngram8");
    expect(line.regen.ok).toBe(true);
    log.mockRestore();
  });
  it("retry blocked too → empty (the client's fallback)", async () => {
    drafts.push([`Try this: ${GHOST.thesis}`], [`Or: ${GHOST.paper.split(". ")[3]}.`]);
    expect((await call()).paras).toEqual([]);
  });
  it("a generic answer passes on the first try", async () => {
    drafts.push(["Transformational leaders inspire people with a shared vision of the future, while servant leadership puts the needs of the team first."]);
    expect((await call()).paras.length).toBe(1);
  });
});
