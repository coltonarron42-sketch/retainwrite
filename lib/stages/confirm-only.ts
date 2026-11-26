/**
 * A yes / confirm phrase is a reply to Pau, never a lead, claim, or official note.
 * Includes confirm-plus-filler ("Yes, that is my plan for the body.", "yep that's it",
 * "sounds right") so those words cannot land on the lock card.
 */
const SECTION = String.raw`(?:the |this |my |our )?(?:body|intro(?:duction)?|conclusion|section|part|one|it)`;

const BARE =
  /^(?:y(?:es|eah|ep|up|a)?|sure|ok(?:ay)?|right|correct|exactly|absolutely|definitely|totally|perfect|alright|all right|please|thanks?|thank you|cool|great|good|fine|yeah sure)$/;

const FILLER = new RegExp(
  `^(?:` +
    `that(?: is|'s) (?:it|all|everything|fine|good|right|correct|enough|the (?:one|plan)|my (?:plan|call|angle|idea|choice))(?: for (?:now|${SECTION}))?` +
    `|this(?: is|'s) (?:it|the plan|my plan)(?: for ${SECTION})?` +
    `|sounds? (?:right|good|great|fine|correct|about right)` +
    `|looks? (?:right|good|great|fine|correct)` +
    `|that works(?: for me)?` +
    `|you got it|got it|i'?m good|all good|good for now|for now` +
    `|lock (?:it|that|this) in` +
    `|let'?s go|go (?:ahead|with (?:it|that|this))` +
    `|that is my plan(?: for ${SECTION})?` +
    `|that'?s my plan(?: for ${SECTION})?` +
    `)$`,
);

const LEADING =
  /^(?:(?:oh|um+|uh+|hmm+|well|so|okay|ok|alright)\s+)*(?:yes|yeah|yep|yup|ya|sure|ok(?:ay)?|right)(?:\s+|$)/;

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[.!?…]+$/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the whole reply is only a confirmation, including confirm-plus-filler
 * like "yes, that is my plan for X". False when any real plan or claim remains.
 */
export function isConfirmOnly(text: string | null | undefined): boolean {
  let t = normalize(String(text ?? ""));
  if (!t) return false;
  for (let i = 0; i < 4; i++) {
    if (BARE.test(t) || FILLER.test(t)) return true;
    const next = t.replace(LEADING, "").trim();
    if (next === t) break;
    t = next;
    if (!t) return true;
  }
  return BARE.test(t) || FILLER.test(t);
}

/** A student-named lead, or null when the text is only a confirm phrase. */
export function officialLeadName(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  if (!t || isConfirmOnly(t)) return null;
  return t;
}
