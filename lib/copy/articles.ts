/**
 * Putting list items from an assignment sheet into Pau's sentences:
 * "Works Cited page" → "a Works Cited page", "abstract" → "an abstract",
 * "address at least one counterargument" → not a noun phrase (null).
 */

const DETERMINER = /^(a|an|the|one|two|three|four|five|at least|at most|each|every|your|any|some|no|its|their|all|both|\d+)\b/i;
/** Instruction verbs that start a sentence fragment rather than name a thing. */
const VERB_START =
  /^(address|discuss|include|includes|use|uses|explain|analy[sz]e|describe|compare|contrast|answer|respond|cite|support|provide|make|write|state|present|identify|evaluate|consider|connect|apply|argue|show|demonstrate|summari[sz]e|reflect|develop|incorporate|avoid|follow|submit|format|organi[sz]e|end|begin|start|close|open|restate|acknowledge|refute|rebut|engage|integrate|define|list|keep|put|place|add|have|give|offer|take|note|be|do|need|must|should)\b/i;
/** "an" before vowel sounds, with the common exceptions. */
const AN_SOUND = /^(?:[aeio]|u(?!ni|s[eu]|ti|r[aeiou])|honest|hour|heir|mla\b|apa\b|fbi\b|[fhlmnrsx]\b|[aefhilmnorsx][A-Z0-9]*\b(?=[A-Z]))/i;

export function startsWithVerb(phrase: string): boolean {
  return VERB_START.test(phrase.trim());
}

export function indefiniteArticle(word: string): "a" | "an" {
  const w = word.trim();
  if (/^\d/.test(w)) return /^8|^1[18](?![\d])|^1[18],\d{3}(?![\d,])/.test(w) ? "an" : "a";
  if (/^(one|once|uni|use|usu|euro|ewe)/i.test(w)) return "a";
  if (/^[A-Z]{2,}\b/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? "an" : "a";
  return AN_SOUND.test(w) ? "an" : "a";
}

/** A noun phrase with the right article, or null when the item is an instruction. */
export function withArticle(phrase: string): string | null {
  const text = phrase.replace(/\s+/g, " ").trim().replace(/[.;:,]+$/, "");
  if (!text) return null;
  if (startsWithVerb(text)) return null;
  const keepCase = /^[A-Z]{2,}|^[A-Z][a-z]+\s+[A-Z]/.test(text); // "MLA heading", "Works Cited page"
  const lead = keepCase ? text : text.charAt(0).toLowerCase() + text.slice(1);
  if (DETERMINER.test(lead)) return lead;
  if (/s\b/.test(lead.split(" ")[0]) && /^(margins|references|notes|sources|citations|headings|page numbers)$/i.test(lead)) return lead;
  return `${indefiniteArticle(lead)} ${lead}`;
}
