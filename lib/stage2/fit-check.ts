/**
 * PC-32 FIT CHECK (Colton t227u). When the student picks a leadership style and a leader in
 * Stage 2's stance step, Pau quickly judges whether that leader has good, well-documented
 * support for that style.
 *
 * - Solid: one line that affirms it, then the flow moves on (no friction).
 * - Weak or random: brief, kind feedback, the concept re-grounded in plain words first, then
 *   1-2 better-fitting examples, and the student may keep theirs. Pau never overrules and
 *   nothing is locked without the student.
 * - R1: no lecture, and the fit lines never ask a question (the step's own ask is the one question).
 * - R2: no invented facts. Concepts and examples come from this short, well-documented table;
 *   when Pau isn't sure, she says so and labels it general background.
 *
 * Pure: shared by the /coach/fit route (server) and the stance chat (client). Never the ghost.
 * // SOP: coaching only, never generate submission text
 */
import { chosenStyles } from "@/lib/stage1/north-turns";
import { leaderAcross } from "@/lib/stage1/lock-in";

export type FitPair = { style: string; leader: string };
export type FitVerdict = "strong" | "weak" | "unsure";
export type FitExample = { name: string; why: string };
export type FitBasis = "known" | "research" | "general";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s-]/g, "").replace(/\s+/g, " ").trim();

/** The style + leader they named in this note (both needed). A name from the sheet is never their leader. */
export function fitPairIn(text: string, sheet = ""): FitPair | null {
  const style = chosenStyles([text])[0];
  const leader = leaderAcross([text], sheet);
  if (!style || !leader) return null;
  return { style: style.toLowerCase(), leader };
}

export const fitKey = (p: FitPair) => `fit:${norm(p.style)}|${norm(p.leader)}`;

/** The concept in plain words (general background, never a sentence for their paper). */
export const FIT_CONCEPTS: Record<string, string> = {
  servant: "servant leadership means the leader puts the team first: listening, supporting people and helping them grow, and trusting the results to follow.",
  transformational: "transformational leadership means inspiring people with a big shared vision and pushing them to grow past what they thought they could do.",
  transactional: "transactional leadership runs on clear deals: set the goals, check the work, and reward (or correct) what gets done.",
  situational: "situational leadership means changing your approach to fit the people and the moment: more directing when they're new, more hands-off when they're ready.",
  democratic: "democratic leadership means sharing decisions with the team and letting their input shape the call.",
  autocratic: "autocratic leadership means the leader makes the calls alone and expects the team to follow them.",
  charismatic: "charismatic leadership means people follow because of the leader's personal pull: energy, conviction and presence.",
  authentic: "authentic leadership means leading from your real values and being open about who you are, so people trust you.",
  "laissez-faire": "laissez-faire leadership means stepping back and trusting the team to make most decisions themselves.",
};

/**
 * Leaders widely held up as examples of each style in management textbooks and case studies.
 * Only these are ever suggested (R2: never an invented example). Kept short on purpose: a style
 * with no entry gets no suggestions, never a guess.
 */
export const FIT_EXAMPLES: Record<string, FitExample[]> = {
  servant: [
    { name: "Herb Kelleher", why: "Southwest Airlines' co-founder, famous for putting employees first" },
    { name: "Cheryl Bachelder", why: "turned Popeyes around by serving its franchise owners first" },
    { name: "Sam Walton", why: "built Walmart's culture around serving customers and associates" },
  ],
  transformational: [
    { name: "Satya Nadella", why: "reshaped Microsoft's culture around a growth mindset" },
    { name: "Nelson Mandela", why: "united a divided country around a shared vision" },
  ],
  charismatic: [{ name: "Martin Luther King Jr.", why: "moved people through conviction and presence" }],
};

/** Pairs whose fit is well documented either way (no model call needed). */
const KNOWN_FITS: { style: string; leader: RegExp; verdict: Exclude<FitVerdict, "unsure"> }[] = [
  { style: "servant", leader: /\bwalton\b/i, verdict: "strong" },
  { style: "servant", leader: /\bkelleher\b/i, verdict: "strong" },
  { style: "servant", leader: /\bbachelder\b/i, verdict: "strong" },
  { style: "servant", leader: /\b(?:elon\s+)?musk\b/i, verdict: "weak" },
  { style: "servant", leader: /\bsteve\s+jobs\b/i, verdict: "weak" },
  { style: "transformational", leader: /\bnadella\b/i, verdict: "strong" },
  { style: "transformational", leader: /\bmandela\b/i, verdict: "strong" },
];

export function knownFit(p: FitPair): Exclude<FitVerdict, "unsure"> | null {
  return KNOWN_FITS.find((k) => k.style === norm(p.style) && k.leader.test(p.leader))?.verdict ?? null;
}

/** 1-2 better-fitting examples for the style, never the leader they already named. */
export function betterExamples(p: FitPair, n = 2): FitExample[] {
  const last = norm(p.leader).split(" ").at(-1) ?? "";
  return (FIT_EXAMPLES[norm(p.style)] ?? []).filter((x) => !norm(x.name).split(" ").includes(last)).slice(0, n);
}

/** Model judge for pairs not in the table (verdict only: the words Pau says come from here). */
export function fitJudgePrompt(p: FitPair, research: string): { system: string; user: string } {
  return {
    system: [
      "You judge one thing for a writing coach: does this leader have good, well-documented support (biographies, business-school cases, reputable articles) as an example of this leadership style?",
      'Answer "strong" only when that support is widely known. Answer "weak" when the leader is widely known for a clearly different or opposite style. Answer "unsure" when you are not certain either way. Never guess.',
      'Return JSON only: {"verdict": "strong" | "weak" | "unsure"}.',
    ].join("\n"),
    user: [`Style: ${p.style} leadership`, `Leader: ${p.leader}`, research ? `Research already gathered for this assignment (titles only):\n${research}` : ""].filter(Boolean).join("\n\n"),
  };
}

export function parseFitVerdict(text: string): FitVerdict {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const v = String((JSON.parse(m ? m[0] : text) as { verdict?: unknown }).verdict ?? "");
    return v === "strong" || v === "weak" ? v : "unsure";
  } catch {
    return "unsure";
  }
}

/**
 * What Pau says. Strong: one line. Weak: kind feedback, the concept in plain words (labelled),
 * 1-2 better fits, theirs to keep. Unsure: says so, general background. No question marks (R1).
 */
export function fitReply(p: FitPair, verdict: FitVerdict): string[] {
  const style = norm(p.style);
  const concept = FIT_CONCEPTS[style];
  if (verdict === "strong") return [`${p.leader} and ${style} leadership is a solid pair: there's good, well-documented support for it.`];
  if (verdict === "weak") {
    const better = betterExamples(p);
    return [
      `I like that you've picked a real leader. Honestly though, ${p.leader} isn't usually held up as a ${style} leader, so finding support for that could be an uphill climb.`,
      ...(concept ? [`In plain words (general background): ${concept}`] : []),
      better.length
        ? `A couple that fit ${style} leadership better: ${better.map((x) => `${x.name} (${x.why})`).join(", or ")}. Keeping ${p.leader} is completely your call; if you'd like to switch, just tell me.`
        : `Keeping ${p.leader} is completely your call; if you'd like to switch, just tell me.`,
    ];
  }
  return [
    `I'm not sure how well documented ${p.leader} is as a ${style} leader, so take this as general background${concept ? `: ${concept}` : "."}`,
    `If you keep ${p.leader}, look for a source that shows them leading that way.`,
  ];
}
