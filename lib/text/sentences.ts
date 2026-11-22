/**
 * Sentence splitting that does not break on common abbreviations
 * ("Prof. Dana Ruiz", "the U.S. Senate", "e.g. sleep", "Dr. Kim").
 * Shared by read-aloud and any place that splits text into bubbles.
 */
const HOLD = "\u2024"; // one-dot leader stands in for a protected period

// Always part of a name/phrase: never end a sentence after these.
const TITLES = /\b(vs|cf|Prof|Dr|Mr|Mrs|Ms|Mx|St|Mt|Jr|Sr|Rev|Gen|Sen|Rep|Gov|Capt|Lt|Col|Sgt|Fr|Vol|pp|fig|approx|dept|Ave|Blvd|Inc|Ltd|Co|Corp)\.(?=\s)/g;
// Dotted abbreviations: U.S., U.K., e.g., i.e., a.m., p.m., Ph.D.
const DOTTED = /\b(?:[A-Za-z]\.){2,}(?=\s)/g;
// "etc." only when the text clearly continues (lower-case or a digit next).
const SOFT = /\b(etc|al)\.(?=\s+[a-z0-9(])/g;
// A middle initial: "John F. Kennedy".
const INITIAL = /\b([A-Z])\.(?=\s+[A-Z][a-z])/g;

function protect(text: string): string {
  return text
    .replace(DOTTED, (m) => m.replace(/\./g, HOLD))
    .replace(TITLES, (m) => m.replace(".", HOLD))
    .replace(SOFT, (m) => m.replace(".", HOLD))
    .replace(INITIAL, (m) => m.replace(".", HOLD));
}

function restore(text: string): string {
  return text.split(HOLD).join(".");
}

export function splitSentences(text: string): string[] {
  return protect(text)
    .split(/(?<=[.?!][”"')\]]*)\s+/)
    .map((part) => restore(part).trim())
    .filter(Boolean);
}
