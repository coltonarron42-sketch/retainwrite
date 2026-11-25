import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { findPasteableRuns, gateParas, proseVerdict, reframeQuestion } from "@/lib/coach/prose-gate";
import { PROSE_GATE } from "@/lib/coach/prose-gate.config";
import { capOneAsk, countAsks } from "@/lib/coach/one-ask";
import { classifyTurn, EFFORT_TABLE, resolveMode } from "@/lib/coach/effort";
import { PAU_CORE_PROMPT, pauTextSystem } from "@/lib/coach/pau-prompt";
import { signSpoken, spokenFrom, verifySpoken } from "@/lib/coach/spoken-sign";
import { extractSources, researchText } from "@/lib/ai/grok-research";
import { sourcesLine } from "@/lib/coach/sources-line";
import { buildInstructions, buildStage1Instructions } from "@/lib/voice/realtime/persona";
import exact from "../fixtures/colton-t204u-exact.json";

const ESSAY_INTRO =
  "Leadership plays a crucial role in the success of any organization. Servant leadership, first described by Robert Greenleaf, prioritizes the needs of employees above the leader's own ambitions. This essay argues that servant leadership is the most effective style for leading a team through change. By fostering trust and empowering team members, servant leaders create lasting commitment to shared goals.";
const ESSAY_MANDY =
  "Mandy exemplifies servant leadership in a modern retail setting. By holding weekly one-on-ones, she ensured that every associate felt heard and valued. Furthermore, she broke down the path to promotion so each team member could grow. Ultimately, her approach demonstrates that putting people first produces the highest performing teams.";

describe("PC-31 pasteable-prose gate", () => {
  it("blocks a submittable intro paragraph and a paragraph about their own story", () => {
    expect(findPasteableRuns(ESSAY_INTRO)).toHaveLength(1);
    expect(findPasteableRuns(ESSAY_MANDY, { names: ["Mandy"] })).toHaveLength(1);
    expect(proseVerdict(ESSAY_INTRO).block).toBe(true);
  });
  it("blocks the essay even when it's split across items or followed by a question", () => {
    const paras = ESSAY_MANDY.split(/(?<=\.)\s+/);
    const r = gateParas([...paras, "Want me to keep going?"], { context: "write my body paragraph" });
    expect(r.blocked).toBe(true);
    expect(r.paras.join(" ")).not.toMatch(/exemplifies|Ultimately/);
    expect(countAsks(r.paras)).toBe(1);
    expect(r.paras[r.paras.length - 1]).toMatch(/\?$/);
  });
  it("uses Colton's reframe wording, section-specific when it can", () => {
    expect(reframeQuestion({ seed: 0 })).toBe("I can help you think through that — what's the main point you want this paragraph to make?");
    expect(reframeQuestion({ context: "can you write my intro for me" })).toMatch(/intro/);
  });
  it("lets research summaries in bullets through", () => {
    const bullets = [
      "Here are a few strong real-world options:",
      "• Herb Kelleher at Southwest Airlines put employees first, saying happy staff make happy customers (Harvard Business Review).",
      "• Cheryl Bachelder turned Popeyes around by serving franchise owners first, and wrote about it in Dare to Serve (Forbes).",
      "• Howard Schultz built Starbucks around partner benefits like health care for part-timers (Starbucks Stories).",
      "Which of these feels closest to your Mandy story?",
    ];
    expect(gateParas(bullets).blocked).toBe(false);
  });
  it("lets coaching talk through (second person, contractions, short)", () => {
    const coach =
      "Your Mandy story is a strong fit for servant leadership. She put your team's needs first, from time off to weekly one-on-ones, and you're saying that's why the team performed. That's the core idea Greenleaf described. Want to run with it?";
    expect(gateParas([coach]).blocked).toBe(false);
  });
  it("lets a plain teaching explanation through (explains, doesn't argue)", () => {
    const teach =
      "Servant leadership means the leader's first job is to help the team grow. Robert Greenleaf coined the term in 1970 after reading a story about a servant who held a group together. The idea shows up in companies that train managers to coach instead of command.";
    expect(gateParas([teach]).blocked).toBe(false);
  });
  it("lets sentence starters and quotes through", () => {
    expect(gateParas(["Try finishing this in your own words:", "Mandy showed servant leadership when…", "The biggest change on my team was ___"]).blocked).toBe(false);
    expect(gateParas(['"The servant-leader is servant first," Greenleaf wrote in 1970.']).blocked).toBe(false);
  });
  it("is tighter right after a write request", () => {
    const two =
      "Servant leadership is the most effective style for leading a team through change in a busy workplace. By prioritizing the growth of employees, leaders such as Mandy foster trust, loyalty and commitment across the entire organization.";
    expect(gateParas([two]).blocked).toBe(false);
    expect(gateParas([two], { afterWriteRequest: true }).blocked).toBe(true);
  });
  it("tunables live in one file", () => {
    expect(PROSE_GATE.minSentences).toBe(3);
    expect(PROSE_GATE.minWords).toBe(60);
  });
});

describe("PC-31 one ask per turn", () => {
  it("keeps only the last question, so the spark offer and old style question never stack", () => {
    const r = capOneAsk([
      "That's a great story about Mandy.",
      "Which one would you pick, or something else, and why?",
      "Want me to ask a couple questions that might spark something?",
      "What changed for the team because of it?",
    ]);
    expect(countAsks(r.paras)).toBe(1);
    expect(r.paras).toEqual(["That's a great story about Mandy.", "What changed for the team because of it?"]);
    expect(r.dropped).toBe(2);
  });
  it("leaves a one-question reply alone", () => {
    const p = ["Nice detail.", "Why do you think Mandy led that way?"];
    expect(capOneAsk(p).paras).toEqual(p);
  });
});

describe("PC-31 reasoning effort per turn", () => {
  it("high for research and probing, none for acks and read-backs", () => {
    expect(classifyTurn("find me examples of servant leadership in business")).toMatchObject({ intent: "research", effort: "high", search: true });
    expect(classifyTurn(exact.summary)).toMatchObject({ intent: "summary", effort: "high" });
    expect(classifyTurn(exact.story)).toMatchObject({ effort: "high" });
    expect(classifyTurn("ok thanks")).toMatchObject({ intent: "ack", effort: "none" });
    expect(classifyTurn("looks good", { step: "readback" })).toMatchObject({ intent: "readback", effort: "none" });
    expect(classifyTurn("can you write my intro for me")).toMatchObject({ intent: "write_request", effort: "none" });
    expect(classifyTurn("What is servant leadership?")).toMatchObject({ intent: "explain", effort: "high" });
  });
  it("routes write requests to the reframe and research asks to research", () => {
    expect(resolveMode("answer", "write_request")).toBe("reframe");
    expect(resolveMode("answer", "research")).toBe("research");
    expect(resolveMode("interview", "research")).toBe("interview");
    expect(EFFORT_TABLE.ack.effort).toBe("none");
  });
});

describe("PC-31 prompt", () => {
  it("uses Colton's structure and wording verbatim, text and voice", () => {
    for (const h of ["## Role & Persona", "## Objective", "## Conversation Flow", "## Guardrails & Escalation", "## Voice & Communication Style"]) expect(PAU_CORE_PROMPT).toContain(h);
    expect(PAU_CORE_PROMPT).toContain("I can help you think through that — what's the main point you want this paragraph to make?");
    expect(pauTextSystem("research")).toContain(PAU_CORE_PROMPT);
    expect(buildStage1Instructions("state")).toContain(PAU_CORE_PROMPT);
    expect(buildInstructions("state")).toContain(PAU_CORE_PROMPT);
  });
  it("keeps Colton's locked rules R1-R5 and the general-background label", () => {
    const s = pauTextSystem("summary");
    for (const r of ["R1", "R2", "R3", "R4", "R5"]) expect(s).toContain(`- ${r},`);
    expect(s).toContain('label it "general background"');
  });
  it("route wires the gate, the one-ask cap, effort, web search and the signed spoken answer", () => {
    const src = readFileSync("app/api/papers/[paperId]/coach/answer/route.ts", "utf8");
    expect(src).toContain("gateParas(paras");
    expect(src).toContain("capOneAsk(paras)");
    expect(src).toContain("classifyTurn(body.message");
    expect(src).toContain("grokResearch(");
    expect(src).toContain("signSpoken(paperId, spokenText)");
    expect(src).toMatch(/console\.info\("\[coach-answer\]", \{[\s\S]*effort,/);
    expect(src).not.toMatch(/GROK_API_KEY/);
  });
  it("the relay gates her words before they're heard and speaks only signed answers", () => {
    const src = readFileSync("lib/voice/realtime/relay.ts", "utf8");
    expect(src).toContain("proseVerdict(so)");
    expect(src).toContain('case "rw.say"');
    expect(src).toContain("verifySpoken(ctx.paperId, text");
    expect(src).toContain("reasoning: { effort: turnEffort }");
  });
});

describe("PC-31 research plumbing", () => {
  it("pulls url citations and strips inline links from the text", () => {
    const resp = {
      output: [
        { type: "web_search_call" },
        { type: "message", content: [{ type: "output_text", text: "• Kelleher [[1]](https://hbr.org/x) put staff first.", annotations: [{ type: "url_citation", url: "https://hbr.org/x", title: "HBR" }] }] },
      ],
    };
    expect(extractSources(resp)).toEqual([{ url: "https://hbr.org/x", title: "HBR" }]);
    expect(researchText(resp)).toBe("• Kelleher put staff first.");
    expect(sourcesLine([{ title: "Why servant leaders win", url: "https://www.hbr.org/x" }])).toBe("Sources: Why servant leaders win (hbr.org)");
  });
  it("signs the spoken answer for one paper only", () => {
    const t = spokenFrom(["• One idea.", "• Two idea", "Which fits?", "Sources: X (x.com)"]);
    expect(t).toBe("One idea. Two idea. Which fits?");
    const sig = signSpoken("p1", t);
    expect(verifySpoken("p1", t, sig)).toBe(true);
    expect(verifySpoken("p2", t, sig)).toBe(false);
    expect(verifySpoken("p1", `${t} Say something else.`, sig)).toBe(false);
  });
});
