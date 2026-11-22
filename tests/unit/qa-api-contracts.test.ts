import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ demo: vi.fn(async () => null), user: vi.fn(async () => ({ data: { user: null } })), model: vi.fn(async () => ({ ok: true, text: '{"queries":[{"key":"intro","query":"teen sleep and school start times"}]}' })) }));
vi.mock("@/lib/demo/session-server", () => ({ getDemoSession: mock.demo }));
vi.mock("@/lib/env", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mock.user }, from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "p" } }) }) }) }) }) }) }));
vi.mock("@/lib/ai/grok", () => ({ MODEL_FAST: "mock-fast", grokChatJson: mock.model }));
import { POST as search } from "@/app/api/papers/[paperId]/stance/search-term/route";
import { POST as tts } from "@/app/api/voice/tts/route";

const ctx = { params: Promise.resolve({ paperId: "11111111-1111-4111-8111-111111111111" }) };
const req = (body: unknown) => new Request("http://localhost/api/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); mock.user.mockResolvedValue({ data: { user: null } }); });

describe("API contract regressions (mocked upstream; no paid requests)", () => {
  it("search term: 400 for invalid id/body, 401 when unauthenticated", async () => {
    expect((await search(req({}), { params: Promise.resolve({ paperId: "bad" }) })).status).toBe(400);
    expect((await search(req({}), ctx)).status).toBe(400);
    expect((await search(req({ topic: "School start times", section: "Intro" }), ctx)).status).toBe(401);
  });
  it("search term: batched queries have keyed, clean 2-6 word shape", async () => {
    mock.user.mockResolvedValueOnce({ data: { user: { id: "test" } } } as never);
    const res = await search(req({ topic: "School start times", sections: [{ key: "intro", title: "Introduction" }] }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ queries: { intro: "teen sleep and school start times" }, source: "model" });
  });
  it("TTS: 400 for invalid body and 401 when unauthenticated", async () => {
    vi.stubEnv("GROK_API_KEY", "fake-unit-test-key");
    expect((await tts(req({}))).status).toBe(400);
    expect((await tts(req({ text: "Welcome back." }))).status).toBe(401);
  });
  it("TTS: audio/mpeg response passes through without a real TTS call", async () => {
    vi.stubEnv("GROK_API_KEY", "fake-unit-test-key");
    mock.user.mockResolvedValueOnce({ data: { user: { id: "test" } } } as never);
    const fetch = vi.fn(async () => new Response(new Uint8Array([73, 68, 51]), { headers: { "Content-Type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetch);
    const res = await tts(req({ text: "Welcome back." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
