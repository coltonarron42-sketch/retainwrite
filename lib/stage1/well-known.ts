/**
 * QA 9:37 AM (top regression): well-known assigned works get a deterministic,
 * labeled general-knowledge summary every time (book- or article-level, never a
 * specific chapter's contents). Obscure or unidentifiable works are not here,
 * so Pau Pau still says she won't guess about those.
 * // SOP: coaching only, never generate submission text
 */
export type WellKnownWork = { id: string; title: string; bookLevel: boolean; points: string[] };

const CATALOG: { test: (w: string) => boolean; work: WellKnownWork }[] = [
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
export function wellKnownWork(work: string): WellKnownWork | null {
  const w = (work ?? "").replace(/[‘’]/g, "'");
  return CATALOG.find((c) => c.test(w))?.work ?? null;
}
