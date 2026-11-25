import { describe, expect, it } from "vitest";
import { applySectionPatch, mergeSectionIdeas, mergeTranscript, type LoopLine } from "@/lib/stages/stance-turn";

const A = "Walton visited stores, listened to associates and shared profits with them, and that kept people bought in while Walmart kept expanding.";
const B = "Walton asked associates what they needed on the floor and then acted on it, which is the servant side, while his big vision for growth is the transformational side.";

type Sec = { key: string; ideas: string[]; loopStep?: string };
type Sess = { sections: Sec[]; transcript?: LoopLine[]; answers?: { kind: string; text: string }[] };

const line = (text: string, who: LoopLine["who"] = "you"): LoopLine => ({ k: "body", who, text });

describe("PC-30 body-loss: a stale lock-in cannot drop a just-saved Body note", () => {
  it("mergeSectionIdeas keeps both notes when a stale confirm only has the first", () => {
    expect(mergeSectionIdeas([A], [A])).toEqual([A]);
    expect(mergeSectionIdeas([A, B], [A])).toEqual([A, B]);
    expect(mergeSectionIdeas([A], [A, B])).toEqual([A, B]);
  });
  it("an explicit replace does not keep the old claim", () => {
    expect(mergeSectionIdeas([A], [B], true)).toEqual([B]);
  });
  it("mergeTranscript keeps lock-in lines and the added student line", () => {
    const saved = [line("Want to lock this one in?", "pau"), line(A), line(B), line("I added that to your note, and your earlier words stay too.", "pau")];
    const staleLock = [line("Want to lock this one in?", "pau"), line(A), line("Yes, lock it in", "pick")];
    const merged = mergeTranscript(staleLock, saved);
    expect(merged.map((l) => l.text)).toContain(B);
    expect(merged.map((l) => l.text)).toContain("Yes, lock it in");
    expect(merged.filter((l) => l.text === A)).toHaveLength(1);
  });
  it("applySectionPatch: saving the second note, then a stale confirm, keeps both ideas", () => {
    const first: Sess = { sections: [{ key: "body", ideas: [A], loopStep: "summarize" }], transcript: [line(A)], answers: [{ kind: "probe", text: A }] };
    const afterSave = applySectionPatch(first, "body", { ideas: [A, B], loopStep: "summarize" }, {
      transcript: [line(A), line(B)],
      answers: [{ kind: "probe", text: A }, { kind: "probe", text: B }],
    });
    expect(afterSave.sections[0]!.ideas).toEqual([A, B]);
    // The confirm click still closed over the first-note snapshot and wrote ideas: [A].
    const afterStaleConfirm = applySectionPatch(afterSave, "body", { ideas: [A], loopStep: "logic_check" }, {
      transcript: [line(A), line("Yes, lock it in", "pick")],
    });
    expect(afterStaleConfirm.sections[0]!.ideas).toEqual([A, B]);
    expect(afterStaleConfirm.sections[0]!.loopStep).toBe("logic_check");
    expect(afterStaleConfirm.transcript?.map((l) => l.text)).toContain(B);
    expect(afterStaleConfirm.transcript?.map((l) => l.text)).toContain("Yes, lock it in");
  });
  it("the other order: stale confirm lands first, then the save patch still adds the second note", () => {
    const first: Sess = { sections: [{ key: "body", ideas: [A], loopStep: "summarize" }], transcript: [line(A)] };
    const afterStaleConfirm = applySectionPatch(first, "body", { ideas: [A], loopStep: "logic_check" }, {
      transcript: [line(A), line("Yes, lock it in", "pick")],
    });
    const afterSave = applySectionPatch(afterStaleConfirm, "body", { ideas: [A, B], loopStep: "summarize" }, {
      transcript: [line(A), line(B), line("I added that to your note, and your earlier words stay too.", "pau")],
    });
    expect(afterSave.sections[0]!.ideas).toEqual([A, B]);
    expect(afterSave.transcript?.map((l) => l.text)).toContain("Yes, lock it in");
    expect(afterSave.transcript?.map((l) => l.text)).toContain(B);
  });
});
