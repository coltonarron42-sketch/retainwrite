/**
 * PC-32 QA 4:57 PM (MUST-FIX 2): server-side proof that the ghost never leaves the server.
 * The real route handlers run against a mocked database that holds a REAL sealed ghost row
 * (plus the lock and fit rows), and every response body is checked for server:* keys, the
 * sealed blob, and the ghost's own sentences. The model is mocked to try to leak the ghost.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { sealGhost, type GhostScript } from "@/lib/ghost/script";

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => undefined }));
vi.mock("@/lib/env", async (orig) => ({ ...(await orig<typeof import("@/lib/env")>()), hasSupabaseConfig: () => true }));
vi.mock("@/lib/demo/session-server", () => ({ getDemoSession: async () => null }));
vi.mock("@/lib/server/voice/capture", () => ({ refreshVoiceProfile: async () => undefined }));
vi.mock("@/lib/server/paper-context/store", () => ({
  loadPaperContextBlock: async () => ({ block: "Assignment: argue which leadership style works best during change." }),
  readPaperContext: async () => ({ v: 1, northstar: true }),
}));

const SECRET = "test-service-role-secret-for-ghost-exposure";
const PAPER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const GHOST_SENTENCES = [
  "Servant leadership succeeds during organizational change because it builds the trust that employees need before they accept uncertainty.",
  "A regional hospital rebuilt morale after its merger when every nurse manager met each nurse individually before the new schedules began.",
];
const GHOST: GhostScript = {
  v: 1,
  inputHash: "h",
  thesis: GHOST_SENTENCES[0]!,
  outline: [{ section: "Body 1", points: ["trust before change", "hospital merger example"] }],
  paper: Array.from({ length: 24 }, (_, i) => GHOST_SENTENCES[i % 2]).join(" "),
  sources: [{ title: "Greenleaf Center", url: "https://www.greenleaf.org" }],
  startingKind: "has_ideas",
  at: 1,
  searches: 3,
};

let rows: { field_key: string; draft_text: string; submitted: boolean; updated_at: string }[] = [];
const upserts: unknown[] = [];

/** A chainable stand-in for the Supabase query builder (filters by eq). */
function table(name: string) {
  const filters: Record<string, unknown> = {};
  const data = () => {
    if (name === "papers") return [{ id: PAPER_ID, current_stage: 2, resume: null }];
    if (name === "paper_autosaves") return rows.filter((r) => !("field_key" in filters) || r.field_key === filters.field_key);
    return [];
  };
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (k: string, v: unknown) => ((filters[k] = v), q),
    order: () => q,
    maybeSingle: async () => ({ data: data()[0] ?? null, error: null }),
    upsert: async (row: unknown) => (upserts.push(row), { error: null }),
    insert: async () => ({ error: null }),
    update: () => q,
    then: (res: (v: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: data(), error: null }).then(res),
  };
  return q;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: USER_ID } }, error: null }), getUser: async () => ({ data: { user: { id: USER_ID } } }) },
    from: (name: string) => table(name),
  }),
}));
// The model tries to hand the ghost over word for word.
vi.mock("@/lib/ai/grok", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/grok")>()),
  grokChatJson: async () => ({ ok: true, model: "m", text: JSON.stringify({ paras: [`Here's a strong line: ${GHOST_SENTENCES[0]}`], verdict: "unsure" }) }),
}));

const ctx = { params: Promise.resolve({ paperId: PAPER_ID }) };
const post = (body: unknown) => new Request("http://x/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** No server key, no sealed blob, no ghost sentence (or any 6-word run of one) in a body. */
function assertClean(name: string, body: string) {
  expect(body, name).not.toMatch(/server:|rwg1:|ghost_script|ghost_pending|fit_checks/);
  for (const s of GHOST_SENTENCES) {
    const w = s.split(" ");
    for (let i = 0; i + 6 <= w.length; i++) expect(body.includes(w.slice(i, i + 6).join(" ")), `${name}: "${w.slice(i, i + 6).join(" ")}"`).toBe(false);
  }
}

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  process.env.GROK_API_KEY = "test";
  const now = new Date().toISOString();
  rows = [
    { field_key: "server:ghost_script", draft_text: sealGhost(GHOST, SECRET), submitted: false, updated_at: now },
    { field_key: "server:ghost_pending", draft_text: "1", submitted: false, updated_at: now },
    { field_key: "server:fit_checks", draft_text: "{}", submitted: false, updated_at: now },
    { field_key: "stage1:ideas_check", draft_text: "Sam Walton, servant leadership", submitted: true, updated_at: now },
    { field_key: "paper_context", draft_text: JSON.stringify({ v: 1, northstar: true }), submitted: false, updated_at: now },
  ];
});

describe("PC-32 ghost exposure: every client-facing read on a paper WITH a stored ghost", () => {
  it("the sealed row really is there (the routes below had a ghost to leak)", async () => {
    const { readGhost } = await import("@/lib/server/ghost/store");
    const { createClient } = await import("@/lib/supabase/server");
    const g = await readGhost((await createClient()) as never, PAPER_ID);
    expect(g?.thesis).toBe(GHOST_SENTENCES[0]);
  });

  it("GET /autosave: drafts never include server:* rows or ghost text", async () => {
    const { GET } = await import("@/app/api/papers/[paperId]/autosave/route");
    const body = await (await GET(new Request("http://x"), ctx)).text();
    assertClean("GET autosave", body);
    expect(body).toContain("stage1:ideas_check");
  });

  it("POST /autosave: a server:* key can't be written or overwritten", async () => {
    const { POST } = await import("@/app/api/papers/[paperId]/autosave/route");
    const n = upserts.length;
    const res = await POST(post({ fieldKey: "server:ghost_script", text: "x" }), ctx);
    expect(res.status).toBe(400);
    expect(upserts.length).toBe(n);
  });

  it("POST /coach/answer (stage 2, ghost read): a reply that copies the ghost is dropped", async () => {
    const { POST } = await import("@/app/api/papers/[paperId]/coach/answer/route");
    const res = await POST(post({ mode: "answer", message: "what should my thesis be?", stage: 2, section: "Intro" }), ctx);
    const body = await res.text();
    assertClean("POST coach/answer", body);
    expect(JSON.parse(body)).toEqual({ paras: [] });
  });

  it("POST /coach/fit: table lines only, never the ghost", async () => {
    const { POST } = await import("@/app/api/papers/[paperId]/coach/fit/route");
    for (const pair of [{ style: "servant", leader: "Sam Walton" }, { style: "servant", leader: "Elon Musk" }, { style: "servant", leader: "Mandy Lopez" }]) {
      const body = await (await POST(post({ pair, source: "entry" }), ctx)).text();
      assertClean(`POST coach/fit ${pair.leader}`, body);
      expect(JSON.parse(body).paras.length).toBeGreaterThan(0);
    }
  });
});
