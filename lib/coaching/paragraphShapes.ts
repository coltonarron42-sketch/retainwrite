// SOP: coaching only, never generate submission text

export const PARAGRAPH_SHAPES = {
  body: {
    id: "point_proof",
    title: "Point, then proof",
    line: "Point → proof → explain → link back",
  },
  counter: {
    id: "other_side",
    title: "The other side, then your response",
    line: "Fair version of the other side → your response → why yours holds",
  },
  conclusion: {
    id: "look_back",
    title: "A conclusion can look back",
    line: "What you covered → what you figured out → how it finishes",
    card: "A conclusion can look back. Remind the reader what you covered, then step back: what did you figure out by writing this, what conclusions did you draw, and how does your paper finish? End on why it matters now.",
  },
  memory: {
    id: "moment",
    title: "The moment",
    line: "The moment → the detail → what it meant",
  },
} as const;

export const CONCLUSION_PROMPTS = [
  "Looking back over your paper, what do you understand now that you didn't at the start?",
  "Which of your points surprised you most while writing it?",
  "If a classmate read only your conclusion, what should they walk away thinking?",
  "How does your paper finish: with an answer, a question, or a call to do something?",
] as const;

export const ROUGH_INTRO_COPY = "That's a real intro. Now we can make it flow.";

export const WRITE_FOR_ME_DECLINE =
  "I can't write it for you. That's the part that makes it yours, and it's what you'll remember. Let's get your first words down: what's the one thing this paragraph needs to say?";
