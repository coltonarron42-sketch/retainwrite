/** QA 6:15 PM: coach/answer for a leader question retries once for facts, then says so plainly. */
import { describe, expect, it, vi } from "vitest";

const PAPER_ID = "2d4db14a-58a3-4bb3-a286-31cf8832c2c3";
const replies: unknown[] = [];
const ctx = {
  summaries: [{ kind: "knowledge", title: "Goleman's “What Makes a Leader?”", points: ["Goleman argues emotional intelligence sets the best leaders apart."] }],
  missing: ["Northouse's Leadership: Theory and Practice, Ch. 4"],
};
vi.mock("@/lib/demo/session-server", () => ({ getDemoSession: async () => null }));
vi.mock("@/lib/env", async (orig) => ({ ...(await orig<typeof import("@/lib/env")>()), hasSupabaseConfig: () => true }));
vi.mock("@/lib/server/paper-context/store", () => ({ loadPauContextBlock: async () => ({ block: "Assignment: leadership through change.", ctx }), loadPaperContextBlock: async () => ({ block: "Assignment: leadership through change.", ctx }) }));
vi.mock("@/lib/server/ghost/store", () => ({ readGhost: async () => null, backfillGhost: async () => undefined }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u" } }, error: null }) },
    from: () => {
      const q: Record<string, unknown> = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: PAPER_ID }, error: null }) };
      return q;
    },
  }),
}));
vi.mock("@/lib/ai/grok", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/grok")>()),
  grokChatJson: async () => ({ ok: true, model: "m", text: JSON.stringify(replies.shift() ?? {}) }),
}));

const call = async (message: string) => {
  const { POST } = await import("@/app/api/papers/[paperId]/coach/answer/route");
  const req = new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "answer", message, stage: 1 }) });
  return (await (await POST(req, { params: Promise.resolve({ paperId: PAPER_ID }) })).json()) as { paras: string[] };
};
const EMPTY = { explain: "", readingPoints: [], leaderFacts: ["Servant leadership means putting followers first, and Northouse lists it as one approach."], question: "Which of those do you want to build on in your paper?" };

describe("QA 6:15 PM: Walton HOW with no leader facts", () => {
  it("retries once and shows the facts it gets", async () => {
    replies.push(EMPTY, {
      explain: "",
      readingPoints: [],
      leaderFacts: ["Sam Walton visited stores constantly and asked associates for ideas.", "He started profit sharing so associates shared in the company's success."],
      question: "Which of those do you want to build on in your paper?",
    });
    const r = await call("How did Sam Walton show servant leadership?");
    expect(r.paras.join(" ")).toContain("visited stores constantly");
    expect(r.paras.join(" ")).not.toMatch(/Northouse/);
    expect(r.paras.at(-1)).toBe("Which of those do you want to build on in your paper?");
  });
  it("still none after the retry: says so plainly and never invents", async () => {
    replies.push(EMPTY, EMPTY);
    const r = await call("How did Sam Walton show servant leadership?");
    expect(r.paras[0]).toMatch(/I don't have solid facts about Sam Walton/);
    expect(r.paras.join(" ").match(/\?/g)).toHaveLength(1);
  });
  it("a body request about Walton gets the warm template with no model call", async () => {
    const r = await call("Write my body paragraph about Walton");
    expect(r.paras).toHaveLength(1);
    expect(r.paras[0]).toMatch(/^That part's yours to write/);
    expect(r.paras[0]).toMatch(/about Walton\?$/);
  });
});
