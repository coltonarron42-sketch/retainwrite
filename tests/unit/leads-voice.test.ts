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
    expect(src).toContain('[{ key: "leads:intro", text: LEADS_INTRO }]');
    expect(src).not.toMatch(/key: `lead:/);
    expect(src).toContain('target="_blank"');
    expect(src).toContain("(opens in a new tab)");
    // Leads fold into the current turn (QA 9:53): intro + links, then the question, ONE reply.
    expect(src).toContain("const leadsBubbles = leadsShown ? [LEADS_INTRO, leadsList] : [];");
    expect(src).not.toContain("<PauPauGroup bubbles={[LEADS_INTRO]}>");
    const gate = src.slice(src.indexOf('headingId="gate-ask"') - 1500, src.indexOf('headingId="gate-ask"'));
    expect(gate).toMatch(/bubbles=\{\[\s*\.\.\.leadsBubbles,\s*"That's everything for Stage 1/);
    expect(gate).toContain("headingIndex={leadsBubbles.length}");
    const ask = src.slice(src.indexOf('headingId="coach-question"') - 900, src.indexOf('headingId="coach-question"'));
    expect(ask).toContain("...leadsBubbles,");
    expect(ask).toContain("leadsBubbles.length +");
  });
});

import { exampleLeadWhy, practitionerSearchTerms } from "@/lib/stage1/leads";
import { SUMMARY_OPENERS } from "@/lib/stage1/pau-pau";

describe("QA 9:53 Stage 1 follow-ups", () => {
  const src = readFileSync("components/stages/stage1/assignment-intake.tsx", "utf8");
  it("voice skips link labels and lead cards and reads only her intro", () => {
    const items = src.slice(src.indexOf("const threadSpeak: SpeakItem[] = ["), src.indexOf("].filter((i, idx, all)", src.indexOf("const threadSpeak")));
    expect(items).toContain('{ key: "leads:intro", text: LEADS_INTRO }');
    expect(items).not.toMatch(/leadLinks|link\.label|lead\.name|whyAssignment|Google Scholar|YouTube/);
    // The intro is spoken before the question it rides with.
    expect(items.indexOf("leads:intro")).toBeLessThan(items.indexOf("text: currentTurnTexts[0]!"));
    expect(LEADS_INTRO).not.toMatch(/Scholar|YouTube|News stories|http/);
  });
  it("no 'Thanks, that helps.' opener after an upload (or anywhere in the read-back)", () => {
    expect(SUMMARY_OPENERS).not.toContain("Thanks, that helps.");
    for (const o of SUMMARY_OPENERS) expect(o).not.toMatch(/^Thanks/);
  });
  it("the practitioner lead has its own search, distinct from the base topic search", () => {
    const topic = "Did the printing press change European politics?";
    const base = leadSearchTerms(topic);
    const prac = practitionerSearchTerms(topic, "baking");
    expect(prac).not.toBe(base);
    expect(prac).toMatch(/practitioner interview case study/);
    expect(prac).toContain("baking");
    expect(practitionerSearchTerms(topic)).not.toBe(base);
    const lead = createLead({ name: "A practitioner voice in this topic", whyAssignment: "x", searchTerms: prac });
    expect(leadLinks(lead)[0]!.href).not.toBe(leadLinks(createLead({ name: "b", whyAssignment: "x", searchTerms: base }))[0]!.href);
    expect(src.match(/searchTerms: practitionerSearchTerms\(/g)).toHaveLength(2);
  });
  it("the example lead has a concrete reason, not 'Connects to the assignment's required angle'", () => {
    expect(src).not.toContain("Connects to the assignment's required angle.");
    expect(exampleLeadWhy("soccer", "Should schools start later?")).toBe('A real case from soccer you can test your take on "Should schools start later" against.');
    // Long prompts are not cut mid-sentence.
    expect(exampleLeadWhy("soccer", "How did the New Deal change the relationship between Americans and the federal government?")).toBe(
      "A real case from soccer you can test your answer to the prompt's question against.",
    );
  });
});
