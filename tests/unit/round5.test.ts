/** QA round 5 should-fixes (pc28-round5). Code-level: detection, composition, Past chat. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { singleNamedLeader } from "@/lib/stage1/single-name";
import { parseStance } from "@/lib/stage1/paper-context";
import { isNoLeaderSaying, noLeaderReply, pickEscalation } from "@/lib/stage1/north-turns";
import { northstarChecklist } from "@/lib/stage1/intake-resume";
import { screenLines } from "@/lib/chat/turn-recorder";

const OPTS = [
  { label: "Transformational", why: "Lets you show a leader selling a shared vision so people want the change." },
  { label: "Situational", why: "Lets you show a leader shifting style to fit how ready the team is." },
  { label: "Servant", why: "Lets you argue that putting people's needs first carries a team through change." },
];
const PEOPLE = [{ label: "Satya Nadella", why: "Led Microsoft culture shift" }, { label: "Indra Nooyi", why: "Shifted PepsiCo" }];
const asks = (p: string[]) => (p.join(" ").match(/\?/g) ?? []).length;

describe("(1) the leader is found anywhere in the reason", () => {
  const QA = "Servant fits because Walton visited stores, listened to associates, and shared profits with them, which kept people loyal while Walmart grew fast.";
  it("QA's exact Walton reason names Walton (no 'This one needs a real leader' re-ask)", () => {
    expect(singleNamedLeader(QA)).toBe("Walton");
    expect(parseStance(QA, OPTS as never, PEOPLE as never)?.leader).toBe("Walton");
  });
  it("other past-tense actions count too; non-names don't", () => {
    expect(singleNamedLeader("I'd pick servant since Mandy coached every rep.")).toBe("Mandy");
    expect(singleNamedLeader("Servant fits because Walmart grew fast.")).toBeNull();
  });
});

describe("(2) 'I don't really know any leaders'", () => {
  it("is caught", () => {
    expect(isNoLeaderSaying("I don't really know any leaders.")).toBe(true);
    expect(isNoLeaderSaying("I can't think of any good leaders")).toBe(true);
    expect(isNoLeaderSaying("I know servant leadership fits")).toBe(false);
  });
  it("gets reassurance, example leaders and one question about their own boss/coach/teacher; never the style", () => {
    const p = noLeaderReply(PEOPLE as never);
    const all = p.join(" ");
    expect(all).toMatch(/completely fine/);
    expect(all).toContain("Satya Nadella");
    expect(all).toMatch(/boss, coach or teacher/);
    expect(asks(p)).toBe(1);
    expect(all).not.toMatch(/leaning toward|Which leadership style|Transformational, Situational/);
  });
  it("the intake routes it before the vague-pick path", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src.indexOf("isNoLeaderSaying(text)")).toBeGreaterThan(0);
    expect(src.indexOf("isNoLeaderSaying(text)")).toBeLessThan(src.indexOf("let tookRec = false;"));
    // A vague/filler reply to her boss/coach/teacher question stays on it (never the style again).
    expect(src).toMatch(/noLeaderAsked\.current\[q\.id\] && !said0Named\(text\)[\s\S]{0,400}Who comes to mind first\?/);
  });
});

describe("(3) Past chat matches the screen", () => {
  it("the spark offer is its own line (a part drawn as its own block)", () => {
    expect(readFileSync("components/stages/stage1/hesitation.tsx", "utf8")).toMatch(/data-spark\n\s+data-chat-part/);
    const src = readFileSync("lib/chat/turn-recorder.ts", "utf8");
    expect(src).toContain('querySelectorAll("[data-chat-line], [data-chat-part]")');
    expect(src).toContain("[data-chat-part], textarea");
  });
  it("two rapid sends: both student lines on screen stay in Past chat, in order", () => {
    const a = {} as Element, b = {} as Element, c = {} as Element;
    const recs = [
      { who: "you" as const, text: "ok", el: a, born: 1 },
      { who: "pau" as const, text: "Let me make this easier.", el: b, born: 2 },
      { who: "you" as const, text: "hmm", el: c, born: 3 },
    ];
    expect(screenLines(recs, [
      { el: a, who: "you", text: "ok" },
      { el: b, who: "pau", text: "Let me make this easier." },
      { el: c, who: "you", text: "hmm" },
    ]).map((l) => l.text)).toEqual(["ok", "Let me make this easier.", "hmm"]);
  });
});

describe("(4) the gate says what they decided", () => {
  it("names the style and leader", () => {
    const items = northstarChecklist({ confirmed: true, catchUpDone: true, decided: true, stanceOk: true, style: "Servant", leader: "Walton" });
    expect(items[2]!.label).toBe("Decision made, with your reason: your style: servant, your leader: Walton");
  });
});

describe("minor", () => {
  it("the second filler escalation is short, not a second copy of the list", () => {
    const first = pickEscalation({ options: OPTS, round: 2, last: null });
    const second = pickEscalation({ options: OPTS, round: 3, last: first.paras.join("\n") });
    expect(first.paras.filter((p) => p.startsWith("•")).length).toBe(3);
    expect(second.paras.filter((p) => p.startsWith("•")).length).toBe(0);
    expect(asks(second.paras)).toBe(1);
  });
  it("interview: the second question names them; no 'Interview me first' once it's done", () => {
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toContain("`What changed for you or the team after ${who ?? \"they\"} did that?`");
    expect(src).toContain("{interviewDone.current ? null : (");
    expect(src).toContain("interviewDone.current = true;");
    expect(src).toContain('!q1.includes(who.replace(/^your\\s+/, ""))');
  });
});
