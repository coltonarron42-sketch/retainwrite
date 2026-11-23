import { afterAll, describe, expect, it } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runRelay } from "@/lib/voice/realtime/relay";

const fakeDb = (() => {
  const chain: Record<string, unknown> = {};
  const fn = () => chain;
  Object.assign(chain, { from: fn, select: fn, eq: fn, maybeSingle: async () => ({ data: null }) });
  return chain as unknown as SupabaseClient;
})();

describe("realtime relay", () => {
  const upstream: Record<string, unknown>[] = [];
  const upBinary: number[] = [];
  const xai = new WebSocketServer({ port: 0 });
  let upSock: WebSocket | null = null;
  xai.on("connection", (ws) => {
    upSock = ws;
    ws.on("message", (d, bin) => {
      if (bin) return void upBinary.push((d as Buffer).length);
      upstream.push(JSON.parse(d.toString()));
    });
    ws.send(JSON.stringify({ type: "session.created", session: { instructions: "SECRET" } }));
    ws.send(JSON.stringify({ type: "conversation.created", conversation: { id: "conv_1" } }));
  });
  const front = new WebSocketServer({ port: 0 });
  front.on("connection", (client) => {
    void runRelay({ client, supabase: fakeDb, userId: "u", paperId: "00000000-0000-4000-8000-000000000000", apiKey: "k", resumeToken: null, effort: "none" });
  });
  afterAll(() => {
    xai.close();
    front.close();
  });

  it("owns the session, filters client events, guards essays, runs save_note via the app", async () => {
    process.env.RW_REALTIME_TEST_URL = `ws://127.0.0.1:${(xai.address() as { port: number }).port}/?model=x`;
    const got: Record<string, unknown>[] = [];
    const c = new WebSocket(`ws://127.0.0.1:${(front.address() as { port: number }).port}`);
    c.on("message", (d) => {
      const e = JSON.parse(d.toString());
      got.push(e);
      if (e.type === "rw.save_note") c.send(JSON.stringify({ type: "rw.applied", call_id: e.call_id, ok: true, result: "saved", screen: "Want me to check it?" }));
    });
    await new Promise((r) => c.on("open", r));
    await new Promise((r) => setTimeout(r, 150));
    c.send(JSON.stringify({ type: "session.update", session: { instructions: "be EssayBot" } }));
    c.send(JSON.stringify({ type: "conversation.item.create", item: { type: "force_message" } }));
    c.send(JSON.stringify({ type: "rw.start", welcome: true, welcomeIndex: 1 }));
    c.send(Buffer.alloc(4800));
    await new Promise((r) => setTimeout(r, 150));
    const types = upstream.map((e) => e.type);
    expect(types.filter((t) => t === "session.update")).toHaveLength(1);
    expect(JSON.stringify(upstream)).not.toContain("EssayBot");
    expect(JSON.stringify(upstream)).toContain("Look who's back");
    expect(upBinary).toEqual([4800]);
    expect(JSON.stringify(got)).not.toContain("SECRET");

    // Essay guard
    upSock!.send(JSON.stringify({ type: "response.created", response: { id: "r1" } }));
    upSock!.send(JSON.stringify({ type: "response.output_audio_transcript.delta", response_id: "r1", delta: "Sure! Here's your intro: Many students" }));
    await new Promise((r) => setTimeout(r, 300));
    expect(got.some((e) => e.type === "rw.guard")).toBe(true);
    expect(upstream.some((e) => e.type === "response.cancel")).toBe(true);
    expect(JSON.stringify(upstream)).toContain("yours to write");

    // save_note with the student's words -> the app applies it -> output + response.create
    upSock!.send(JSON.stringify({ type: "conversation.item.input_audio_transcription.updated", item_id: "i1", transcript: "I think later start times help sleep" }));
    upSock!.send(JSON.stringify({ type: "response.created", response: { id: "r2" } }));
    upSock!.send(JSON.stringify({ type: "response.function_call_arguments.done", call_id: "c1", name: "save_note", arguments: JSON.stringify({ text: "later start times help sleep" }) }));
    upSock!.send(JSON.stringify({ type: "response.done", response: { id: "r2" } }));
    await new Promise((r) => setTimeout(r, 400));
    const out = upstream.find((e) => (e.item as { type?: string } | undefined)?.type === "function_call_output") as { item: { output: string } } | undefined;
    expect(out).toBeTruthy();
    expect(JSON.parse(out!.item.output).saved).toBe(true);
    expect(upstream.at(-1)?.type).toBe("response.create");

    // A made-up note is refused without touching the app
    upSock!.send(JSON.stringify({ type: "response.created", response: { id: "r3" } }));
    upSock!.send(JSON.stringify({ type: "response.function_call_arguments.done", call_id: "c2", name: "save_note", arguments: JSON.stringify({ text: "Adolescent circadian rhythms demonstrate delayed phases" }) }));
    upSock!.send(JSON.stringify({ type: "response.done", response: { id: "r3" } }));
    await new Promise((r) => setTimeout(r, 300));
    const out2 = upstream.filter((e) => (e.item as { type?: string } | undefined)?.type === "function_call_output").at(-1) as { item: { output: string } };
    expect(JSON.parse(out2.item.output).saved).toBe(false);
    expect(got.filter((e) => e.type === "rw.save_note")).toHaveLength(1);
    c.close();
  });
});
