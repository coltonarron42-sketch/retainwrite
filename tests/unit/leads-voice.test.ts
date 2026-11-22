import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createLead, LEADS_INTRO, leadLinks, leadSearchTerms } from "@/lib/stage1/leads";

describe("F: Pau Pau introduces leads in her own voice, then links", () => {
  it("links are real search links (articles, news, videos), never made-up articles", () => {
    const lead = createLead({ name: "A practitioner voice", whyAssignment: "x", searchTerms: leadSearchTerms("Should high schools start later?") });
    const links = leadLinks(lead);
    expect(links.map((l) => l.kind)).toEqual(["articles", "news", "videos"]);
    expect(links[0]!.href).toBe("https://scholar.google.com/scholar?q=Should%20high%20schools%20start%20later");
    expect(links[2]!.href).toContain("youtube.com/results?search_query=");
  });
  it("interest-steered leads search the interest with the topic; older leads fall back to the topic", () => {
    expect(leadSearchTerms("teen sleep", "soccer")).toBe("soccer teen sleep");
    const old = createLead({ name: "Old lead", whyAssignment: "x" });
    expect(leadLinks(old, "teen sleep")[0]!.href).toContain("q=teen%20sleep");
  });
  it("the intro is in Pau Pau's voice and is the only thing spoken", () => {
    expect(LEADS_INTRO).toMatch(/^I pulled together/);
    const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
    expect(src).toContain('<PauPauGroup bubbles={[LEADS_INTRO]}>');
    expect(src).toContain('[{ key: "leads:intro", text: LEADS_INTRO }]');
    expect(src).not.toMatch(/key: `lead:/);
    expect(src).toContain('target="_blank"');
    expect(src).toContain("(opens in a new tab)");
    // Leads arrive with the stance answer, when the screen moves to the gate: shown there, before the gate question.
    expect(src).toContain('{leads.length > 0 && (screen === "coaching" || screen === "gate") && !stanceMode ? (');
    expect(src.indexOf("<PauPauGroup bubbles={[LEADS_INTRO]}>")).toBeLessThan(src.indexOf('{screen === "gate" ? (\n'));
  });
});
