/**
 * Punctuation around quotes, straight or curly (QA 2:08 #7a/#7b):
 * - a quoted question already ends the sentence: “…or later?”? → “…or later?”
 * - the sentence's own ?/! goes inside the closing quote: …morning”? → …morning?”
 */
export function tidyQuotePunct(text: string): string {
  return text
    .replace(/([?!.])(["”’])[ \t]*[?!.]+/g, "$1$2")
    .replace(/([^?!.\s])([”"])([?!])(?=\s|$)/g, "$1$3$2")
    .replace(/([?!])\1+/g, "$1");
}
