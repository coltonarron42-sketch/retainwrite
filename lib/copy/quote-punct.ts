/**
 * Punctuation around quotes, straight or curly. Only removes a doubled mark
 * after a quote that already ends in one: “…or later?”? → “…or later?”.
 * It never adds or moves a '?' into a quote: a student's statement stays a
 * statement (QA 2:31 #3a, reverting the 2:08 move).
 */
export function tidyQuotePunct(text: string): string {
  return text.replace(/([?!.…])(["”’])[ \t]*[?!.]+/g, "$1$2").replace(/([?!])\1+/g, "$1");
}
