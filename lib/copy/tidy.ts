/**
 * Template punctuation (QA 8:31 AM): "argue?." → "argue?", "point?Check" → "point? Check",
 * doubled periods and stray spaces before punctuation. Display text only.
 */
export function tidyPunct(text: string): string {
  return text
    .replace(/([?!])\s*\.(?!\.)/g, "$1")
    .replace(/([?!])\s*([?!])(?=\s|$)/g, "$1")
    .replace(/(?<!\.)\.\.(?!\.)/g, ".")
    .replace(/\s+([,.;:?!])(?=\s|$)/g, "$1")
    .replace(/([a-z)”"'][?!.])([A-Z][a-zA-Z])/g, "$1 $2")
    .replace(/[ \t]{2,}/g, " ");
}

/**
 * Hedges and fillers never get quoted or paraphrased back (QA 8:31 AM: "…people stuff you guess").
 * "the people stuff I guess" → "the people stuff"; "idk, I think it's X" → "it's X".
 */
export function dropHedges(text: string): string {
  const out = text
    .replace(/[\u2018\u2019]/g, "'")
    // A hedge between two clauses keeps one comma ("bad for change I guess, situational" → "bad for change, situational").
    .replace(/(,?)\s*\b(?:i guess|i suppose|idk|i don'?t know|dunno|maybe|probably|kinda|kind of|sort of|or something|or whatever|like,)\b\s*(,?)/gi, (_m, a: string, b: string, off: number) => ((a || b) && off > 0 ? ", " : " "))
    .replace(/,\s*([.;:?!])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/^\s*(?:um+|uh+|so|well|yeah|ok(?:ay)?)\b[,\s]+/i, "")
    .replace(/\s+([,.;:?!])/g, "$1")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out.length >= 3 ? out : text.trim();
}
