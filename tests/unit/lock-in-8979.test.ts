import { describe, expect, it } from "vitest";
import { asOnSheet, leaderAcross, longEnough, studentTurns, studentWordTotal, yesWithMore } from "@/lib/stage1/lock-in";
import { chosenStyles, informedAffirm, requirementLines, saidReadIt, stylesIn } from "@/lib/stage1/north-turns";
import { parseStance } from "@/lib/stage1/paper-context";
import { proposalReply, reflectStory } from "@/lib/stage1/story-reflect";
import { stage2Earlier } from "@/lib/stages/stage2-intro";
import { northstarChecklist } from "@/lib/stage1/intake-resume";

const SHEET = "BUS 210 Leadership essay for Prof. Kim. Using Chapter 4 of our textbook (Northouse, Leadership: Theory and Practice) and the assigned HBR article 'What Makes a Leader?' by Daniel Goleman, write 1,200-1,500 words arguing which leadership style is most effective for leading a team through change, using one real leader as your example. APA 7. Due Dec 10.";
const T1 = "Oh I'm really excited about this one! I want to use Sam Walton, I think he shows servant and transformational leadership. He walked into stores and talked to associates, and also I've been wondering if Costco or Amazon would be a fun comparison, plus I just want to make sure I hit every requirement.";
const T2 = "Yes, run with it! Although I also think the transformational side matters, because he had this big vision of low prices for everyone, and I keep thinking about how that connects to Goleman's empathy stuff too.";
const T3 = "I already said it, Sam Walton! He's my leader. Both servant and transformational fit him, I love how he walked the stores AND had that giant low-price vision, and honestly I'd even say he's a bit of a coach figure too.";
const T4 = "Okay so my early take is that servant leadership carries a team through change best, because when Walmart was growing so fast Walton kept going into stores and listening, so associates actually trusted the changes. The transformational vision of low prices gave everyone a reason, though, so maybe it's a blend, and I also wonder about how technology changed things for him.";
const OPTIONS = [
  { label: "Transformational", why: "" },
  { label: "Situational", why: "" },
  { label: "Servant", why: "" },
  { label: "Behavioral: task vs. relationship (team management)", why: "" },
];
const PEOPLE = [{ label: "Satya Nadella", why: "" }, { label: "Mary Barra", why: "" }, { label: "Indra Nooyi", why: "" }];
const MUST = ["Chapter 4 of Northouse, Leadership: Theory and Practice", "HBR article 'What Makes a Leader?' by Daniel Goleman", "APA 7 format"];

describe("QA full prod walk 8979326a: what they said is what's locked in", () => {
  it("'Yes, run with it! Although…' is a yes to the proposal, with more", () => {
    expect(reflectStory(T1)?.who).toBe("Sam Walton");
    expect(proposalReply(T2)).toBe("yes");
    expect(yesWithMore(T2)).toMatch(/^Although I also think the transformational side matters/);
    expect(proposalReply("Yes, let's run with it")).toBe("yes");
    // A bare "Okay." before a new story, or a yes that turns around, is not a yes.
    expect(yesWithMore("Okay. So my manager Mandy held one-on-ones with everyone every single week.")).toBeNull();
    expect(yesWithMore("Yes. But not servant, I'd rather switch to situational instead.")).toBeNull();
    expect(proposalReply("No, not quite. I'd rather use situational leadership with Satya Nadella as my example.")).not.toBe("yes");
  });

  it("styles and leader add up across turns: Walton, servant and transformational", () => {
    const pool = studentTurns([T1, T2]).join("\n");
    expect(chosenStyles([pool])).toEqual(["servant", "transformational"]);
    expect(leaderAcross([pool], SHEET)).toBe("Sam Walton");
    const early = parseStance(pool, OPTIONS, PEOPLE);
    expect(early).not.toBeNull();
    const turn = informedAffirm(pool, { leader: early?.leader ?? leaderAcross([pool], SHEET), mustInclude: MUST.map((m) => asOnSheet(m, SHEET)), needsPerson: true }).join("\n");
    expect(turn).toContain("Sam Walton, showing servant and transformational leadership");
    expect(turn).toContain("“Sam Walton, servant and transformational leadership”");
    expect(turn).toContain("✓ A real leader as your example: Sam Walton.");
    expect(turn).toContain("✓ Your styles: servant and transformational.");
    // Only T2 alone (the old bug) would lock in transformational only.
    expect(stylesIn(T2)).toEqual(["transformational"]);
  });

  it("the leader from any turn fills the slot (no menu), never an author from the sheet", () => {
    expect(leaderAcross([T2, T3], SHEET)).toBe("Sam Walton");
    expect(leaderAcross(["I like Daniel Goleman's take on empathy."], SHEET)).toBeNull();
    expect(leaderAcross([T4], SHEET)).toBe("Walton");
  });

  it("'you've read it' only from an explicit statement", () => {
    const pool = studentTurns([T1, T2]).join("\n");
    expect(saidReadIt(pool)).toBe(false);
    const lines = requirementLines(pool, { leader: "Sam Walton", styles: ["servant", "transformational"], mustInclude: MUST, needsPerson: true });
    expect(lines.join("\n")).not.toContain("you've read it");
    expect(lines).toContain("○ HBR article 'What Makes a Leader?' by Daniel Goleman. You brought it up; I'll help you use it.");
    expect(saidReadIt("I read the Goleman article last week")).toBe(true);
    expect(saidReadIt("I've already read both")).toBe(true);
    expect(saidReadIt("I haven't read the Goleman article yet")).toBe(false);
    const read = requirementLines("I read the Goleman article and I want servant leadership", { leader: null, styles: ["servant"], mustInclude: MUST });
    expect(read).toContain("✓ HBR article 'What Makes a Leader?' by Daniel Goleman: you've read it.");
  });

  it("the gate names the leader and every style", () => {
    const gate = northstarChecklist({
      confirmed: true, catchUpDone: false, decided: true, stanceOk: true, earlyFromStory: true,
      styles: chosenStyles([studentTurns([T1, T2]).join("\n"), T3, T4]),
      leader: leaderAcross([T1, T2, T3, T4], SHEET),
    });
    expect(gate[2]!.label).toBe("Decision made, with your reason: your styles: servant and transformational, your leader: Sam Walton");
  });

  it("the voice-amount line counts every student word across turns", () => {
    const total = studentWordTotal([T1, T2, T3, T4, "Yes, let's run with it", T4]);
    expect(total).toBeGreaterThan(190);
    expect(longEnough(total)).toBe(true);
    expect(longEnough(studentWordTotal(["Servant.", "Walton.", "Yes"]))).toBe(false);
    expect(studentWordTotal([T1, `${T1}\n${T2}`])).toBe(studentWordTotal([`${T1}\n${T2}`]));
  });

  it("the Stage 2 recap is whole and names the leader", () => {
    const line = stage2Earlier(
      { at: 1, pick: "Transformational", answer: T4, source: "stated", question: "Which leadership style do you want to argue works best here" } as never,
      { at: 1, pick: "their own", answer: T3, question: "This one needs a real leader as your example." } as never,
      OPTIONS,
    )!;
    expect(line).toContain("with Sam Walton as your example");
    expect(line).toMatch(/servant and transformational leadership/);
    expect(line).toContain("because when Walmart was growing so fast Walton kept going into stores and listening, so associates actually trusted the changes.");
    expect(line).not.toMatch(/…/);
  });

  it("checklist items keep the sheet's leading 'The'", () => {
    expect(asOnSheet("HBR article 'What Makes a Leader?' by Daniel Goleman", SHEET)).toBe("The assigned HBR article 'What Makes a Leader?' by Daniel Goleman");
    expect(asOnSheet("assigned HBR article 'What Makes a Leader?' by Daniel Goleman", SHEET)).toBe("The assigned HBR article 'What Makes a Leader?' by Daniel Goleman");
    expect(asOnSheet("The assigned HBR article 'What Makes a Leader?' by Daniel Goleman", SHEET)).toBe("The assigned HBR article 'What Makes a Leader?' by Daniel Goleman");
    expect(asOnSheet("Chapter 4 of Northouse, Leadership: Theory and Practice", SHEET)).toBe("Chapter 4 of Northouse, Leadership: Theory and Practice");
    expect(asOnSheet("APA 7 format", SHEET)).toBe("APA 7 format");
  });
});
