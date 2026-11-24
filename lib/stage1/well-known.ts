/**
 * QA 9:37 AM (top regression): well-known assigned works get a deterministic,
 * labeled general-knowledge summary every time (book- or article-level, never a
 * specific chapter's contents). Obscure or unidentifiable works are not here,
 * so Pau Pau still says she won't guess about those.
 * // SOP: coaching only, never generate submission text
 */
export type WellKnownWork = { id: string; title: string; bookLevel: boolean; points: string[] };

const MEMORY_POINTS = [
  "Memory works in three steps: encoding (getting information in), storage (keeping it over time), and retrieval (getting it back out when you need it).",
  "The classic Atkinson–Shiffrin model has three stages: sensory memory (a split-second snapshot), short-term memory (a few items for a few seconds, now often called working memory), and long-term memory (lasting, with huge capacity).",
  "Working memory (Baddeley) is where you actively hold and juggle information, like a mental workspace; it's small and easily overloaded, for example by stress or distraction.",
  "The serial position effect: people remember the first items in a list (primacy) and the last ones (recency) better than the middle.",
  "Explicit memories (facts and events you can consciously recall) differ from implicit ones (skills and conditioned habits that show up without effort).",
  "Forgetting comes from encoding failure, storage decay and retrieval failure, including interference from other memories; memories are also reconstructed each time, which is why they can be distorted (Loftus's misinformation effect).",
];

const CATALOG: { test: (w: string, ctx: string) => boolean; work: WellKnownWork }[] = [
  {
    // QA 3:06: a standard intro psych text's memory chapter is general knowledge, never "won't guess".
    test: (w, ctx) => /psycholog/i.test(w) && /\bmemor/i.test(`${w} ${ctx}`),
    work: { id: "intro-psych-memory", title: "the memory chapter of an intro psychology text", bookLevel: false, points: MEMORY_POINTS },
  },
  {
    test: (w) => /\bmyers\b/i.test(w) && /psycholog/i.test(w),
    work: {
      id: "myers-psychology",
      title: "Myers' Psychology",
      bookLevel: true,
      points: [
        "Myers' Psychology is a standard intro text that covers how we think, feel and act, built on research rather than common sense.",
        "It moves from the brain and biology through sensation and perception, learning, memory, thinking and language, to development, personality, disorders and therapy.",
        "Each chapter explains the main findings, the classic studies behind them, and how they apply to everyday life.",
        "It stresses critical thinking: asking what the evidence is, and being wary of hindsight bias and overconfidence.",
      ],
    },
  },
  {
    test: (w) => /goleman/i.test(w) && /what makes a leader/i.test(w),
    work: {
      id: "goleman-what-makes-a-leader",
      title: "Goleman's “What Makes a Leader?”",
      bookLevel: false,
      points: [
        "Goleman argues that IQ and technical skill matter, but emotional intelligence is what sets the most effective leaders apart.",
        "He names five components of emotional intelligence: self-awareness, self-regulation, motivation, empathy, and social skill.",
        "Self-awareness and self-regulation are about knowing your own moods and keeping them in check, so you think before you act.",
        "Motivation, empathy and social skill are about drive beyond money or status, reading how other people feel, and building relationships that move people the way you want.",
        "He says emotional intelligence can be learned, but it takes practice, feedback and time.",
      ],
    },
  },
  {
    test: (w) => /northouse/i.test(w) || /leadership:\s*theory and practice/i.test(w),
    work: {
      id: "northouse-leadership-theory-practice",
      title: "Northouse's Leadership: Theory and Practice",
      bookLevel: true,
      points: [
        "Northouse treats leadership as a process of influencing a group toward a shared goal, not just a trait someone is born with.",
        "The book surveys the major approaches: trait and skills, behavioral (task vs. relationship), situational, transformational, servant and authentic leadership, among others.",
        "Each approach is explained, then weighed by its research support, its strengths and its criticisms.",
        "It pairs each approach with real cases and self-assessment questionnaires so you can apply the ideas.",
      ],
    },
  },
];

/** The labeled general-knowledge entry for a named work, or null when it isn't one we know well. */
export function wellKnownWork(work: string, context = ""): WellKnownWork | null {
  const w = (work ?? "").replace(/[‘’]/g, "'");
  return CATALOG.find((c) => c.test(w, context ?? ""))?.work ?? null;
}
