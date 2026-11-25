// SOP: coaching only, never generate submission text

export type IntroVariant = "thesis" | "story" | "reflective" | "case";

export type IntroFormat = {
  id: string;
  label: string;
  lines: string;
};

export const INTRO_FORMATS: Record<IntroVariant, IntroFormat[]> = {
  thesis: [
    { id: "context_claim", label: "Context, then your point", lines: "Name the situation, then say the point you will defend." },
    { id: "question_claim", label: "A question, then your point", lines: "Open with the question the assignment asks, then your answer." },
    { id: "contrast_claim", label: "Two sides, then your point", lines: "Set up the disagreement, then say where you stand." },
  ],
  story: [
    { id: "scene", label: "A scene", lines: "Start in a moment, then say what that moment will show." },
    { id: "hook", label: "A hook", lines: "Start with one detail a reader can picture, then the so-what." },
  ],
  reflective: [
    { id: "context_insight", label: "Context, then insight", lines: "Say what was going on, then the insight you reached." },
  ],
  case: [
    { id: "situation_question", label: "The situation, then the question", lines: "Describe the case, then the question your analysis answers." },
  ],
};

export const INTRO_FOOTER =
  "Whichever you pick, your intro should tell the reader what this assignment is about, in your words.";

export const FIRST_SUMMARY: Record<IntroVariant, string> = {
  thesis: "In a sentence or two, in your own words: what is this paper about, and what's your main point?",
  story: "In a sentence or two: what moment are you writing about, and what does it show?",
  reflective: "In a sentence or two: what happened, and what did you learn from it?",
  case: "In a sentence or two: what's the situation, and what question are you answering?",
};

export const OPENER =
  "Where are you at on this? Give it a shot, or I can break it down for you.";

export const SHOT_SUMMARY: Record<string, string> = {
  intro: "Context → your point → where the paper is going",
  body: "Point → proof → explain → link back",
  counter: "Fair version of the other side → your response → why yours holds",
  conclusion: "What you covered → what you figured out → how it finishes",
};
