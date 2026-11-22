/**
 * What Pau Pau may say out loud. Only Pau Pau's own sentences: quoted
 * assignment text, instructions and anything the student wrote are never
 * passed in, and quoted fragments that slip through are dropped here.
 */
export const COACH_NAME_SPOKEN_FORM = "Pow pow";

const QUOTE = /[“”"]/;

export function speakableSentences(text: string): string[] {
  let s = text.replace(/\s+/g, " ").trim();
  if (!s) return [];
  // "…, including the American Academy of Pediatrics' “School Start Times…” (2014)." → "."
  s = s.replace(/,?\s*including\s[^.?!]*?[“"][^”"]*[”"](\s*\([^)]*\))?/gi, "");
  // "the question “Should schools…?”" → "this question"
  s = s.replace(/\bthe (question|prompt)\s*[“"][^”"]*[”"]/gi, "this $1");
  s = s.replace(/\(at least \d+ words\)/gi, "");
  const sentences = s
    .split(/(?<=[.?!][”")\]]*)\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !QUOTE.test(x))
    .filter((x) => !/^the big question\b/i.test(x));
  return sentences
    .map((x) =>
      x
        .replace(/\bPau Pau\b/g, COACH_NAME_SPOKEN_FORM)
        .replace(/(\d)\s*[–-]\s*(\d)/g, "$1 to $2")
        .replace(/…/g, ",")
        .replace(/\s*—\s*/g, ", ")
        .replace(/\s+,/g, ",")
        .trim(),
    )
    .filter((x) => /[a-z]/i.test(x));
}
