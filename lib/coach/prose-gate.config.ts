/**
 * PC-31: every tunable for the pasteable-prose gate (lib/coach/prose-gate.ts) in one place.
 * A run of consecutive declarative sentences is "pasteable" when it is at least
 * minSentences long, at least minWords long, and scores at least minEssayScore on
 * the essay-register checks. A student who just asked her to write something gets
 * the tighter "afterWriteRequest" numbers.
 */
export const PROSE_GATE = {
  /** Consecutive declarative sentences (no "?", not a starter, not a bullet) in one run. */
  minSentences: 3,
  /** Words in that run. */
  minWords: 60,
  /** Essay-register score needed (see the weights below). */
  minEssayScore: 3,
  /** A run that scores this high on essay register only needs strongMinWords (a short but unmistakable essay paragraph). */
  strongScore: 5,
  strongMinWords: 40,
  /**
   * Read-back of their own words: when at least this share of a run's content words (4+ letters) come from
   * what the student said, it's Pau reflecting their story back, not original prose (voice QA: her Mandy
   * reflection was gated). Their words are theirs to paste. Measured: a Pau Mandy reflection reused 0.38 of the story's
   * content words; a pasteable Mandy essay paragraph reused 0.18.
   */
  echoShare: 0.33,
  /** Tighter numbers right after "write my intro"-style requests. */
  afterWriteRequest: { minSentences: 2, minWords: 35, minEssayScore: 2 },
  /** A bullet item longer than this is treated as prose, not a summary bullet. */
  bulletMaxWords: 45,
  /** A sentence starter the student must finish: ends in "…", "...", "___" or ":" and is this short. */
  starterMaxWords: 14,
  /** Essay-register weights. */
  weights: {
    /** Each formal connective or academic stock phrase (capped at formalCap). */
    formal: 1,
    formalCap: 2,
    /** No "you/your/I/me/my/let's" anywhere in the run (third-person, paper voice). */
    thirdPerson: 1,
    /** No contractions in the run. */
    noContractions: 1,
    /** Argues a claim ("is the most effective", "demonstrates", "should", "therefore"). */
    argument: 1,
    /** The run talks about the student's own story subject in the third person (a paragraph ABOUT their material). */
    aboutTheirMaterial: 1,
  },
} as const;

/** Formal connectives and stock essay phrases. */
export const FORMAL_MARKERS: RegExp[] = [
  /\b(?:furthermore|moreover|additionally|consequently|nevertheless|thus|hence|ultimately|in conclusion|in summary|to conclude|overall,)\b/i,
  /\b(?:this (?:essay|paper|example|approach|story) (?:demonstrates|shows|illustrates|highlights|argues|will))\b/i,
  /\b(?:exemplif(?:y|ies|ied)|epitomi[sz]es|embod(?:y|ies|ied)|underscores?|plays? a (?:crucial|vital|key|pivotal) role)\b/i,
  /\b(?:it is (?:evident|clear|important to note) that|in today'?s (?:society|world|workplace)|throughout history|by (?:prioriti[sz]ing|fostering|empowering|investing in))\b/i,
  /\b(?:fostered|fostering|cultivat(?:e|ed|ing)|empower(?:ed|ing)?|facilitat(?:e|ed|ing)|leverag(?:e|ed|ing))\b/i,
];

export const ARGUMENT_MARKERS =
  /\b(?:is the most effective|most effective|demonstrates?|proves?|shows? that|illustrates?|therefore|because of this|as a result|should be|must be|is essential|is crucial|is key to|clearly)\b/i;

/** Plain-talk markers: addressing the student, or talking as herself. */
export const CONVERSATIONAL =
  /\b(?:you|your|you're|yours|i|i'm|i'd|i'll|me|my|let's|we'll|here's)\b/i;

/** Reframe questions (rotated for variety; the first is Colton's wording). */
export const REFRAME_QUESTIONS = [
  "I can help you think through that — what's the main point you want this paragraph to make?",
  "That part's yours to write, but I'll help you get there. What's the one thing you want a reader to take from it?",
  "Let's build it from your ideas instead. What's the main point you want this section to land?",
] as const;

/** Section-specific reframes. */
export const REFRAME_FOR: { re: RegExp; q: string }[] = [
  { re: /\bintro(?:duction)?\b/i, q: "I can help you think through that — what's the main point you want your intro to set up?" },
  { re: /\bconclu(?:sion|de)\b/i, q: "I can help you think through that — what do you want a reader to walk away with at the end?" },
  { re: /\bthesis\b/i, q: "I can help you think through that — what's the one claim you want the whole paper to prove?" },
];

/**
 * PC-31 grounding gate for side answers (preview QA: "the essay needs six body paragraphs", not in the
 * assignment; Northouse described with no "general background" label, rule R2).
 */
export const GROUNDING = {
  /** A requirement count is kept only when that number appears in the assignment/paper context. */
  countNouns: "body paragraphs?|paragraphs?|sections?|sources?|references?|citations?|pages?|quotes?|examples?",
  /** Lines that already carry the R2 label. */
  label: /general background|my own (?:general )?knowledge|from what i know|not from your (?:copy|pages|reading|textbook)|in general terms/i,
  /** What she prepends to an unlabeled claim about a reading we don't have the text of. */
  prefix: "General background, not from your copy:",
  /** Verbs that make a line a claim about what a reading says. */
  claimVerbs: /\b(?:argues?|says?|defines?|describes?|explains?|focus(?:es)?|covers?|notes?|puts?|outlines?|treats?|centers?|presents?|claims?|lists?|introduces?|discusses?|highlights?|emphasi[sz]es|names?|calls?|shows?|points? to|positions?|surveys?|stresses?)\b/i,
  /** Capitalized words in reading titles that aren't author names. */
  stopTitleWords: /^(?:Chapter|Chapters|Leadership|Theory|Practice|What|Makes|Leader|Article|Textbook|Harvard|Business|Review|Using|Reading|Readings|Book|Part|Unit|Edition|The|And|Our|Assigned|Introduction|Principles|Guide|Notes|Handout|Journal|Week|Module|Lecture|Case|Study)$/,
};
