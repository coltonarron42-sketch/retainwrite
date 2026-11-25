// SOP: coaching only, never generate submission text

import { wordCount } from "@/lib/utils";

export type HighlightMove = {
  move: string;
  showsQuality: string;
};

export type HighlightReel = {
  instance: string;
  concept: string;
  moves: HighlightMove[];
  confidence: number;
  toVerify: true;
  dropped: boolean;
  line: string;
  searchOffer: string | null;
};

type KnownInstance = {
  names: string[];
  shortName: string;
  concept: string;
  moves: HighlightMove[];
  confidence: number;
};

const KNOWN: KnownInstance[] = [
  {
    names: ["john legere", "legere"],
    shortName: "Legere",
    concept: "servant leadership",
    confidence: 0.84,
    moves: [
      {
        move: "He worked beside frontline staff instead of above them",
        showsQuality: "Putting the team's needs first",
      },
      {
        move: "He cleared obstacles so employees could serve customers",
        showsQuality: "Helping other people grow",
      },
    ],
  },
];

export function conceptRolePhrase(concept: string): string {
  const value = concept.trim();
  if (/^servant leadership$/i.test(value)) return "servant leader";
  if (/leadership$/i.test(value)) return value.replace(/leadership$/i, "leader").trim();
  return value;
}

export function searchOffer(instance: string, concept: string): string {
  return `Want me to search for references on how ${instance} was a ${conceptRolePhrase(concept)}?`;
}

export function guardHighlightReel(reel: HighlightReel): { ok: true } | { ok: false; reason: string } {
  if (reel.dropped) return { ok: true };
  if (reel.moves.length < 1 || reel.moves.length > 2) {
    return { ok: false, reason: "need 1 or 2 moves" };
  }
  if (!reel.toVerify) return { ok: false, reason: "must be to verify" };
  if (!reel.concept.trim()) return { ok: false, reason: "concept required" };
  for (const move of reel.moves) {
    if (wordCount(move.move) > 20) return { ok: false, reason: "move over 20 words" };
    if (/["“”]/.test(move.move)) return { ok: false, reason: "move contains a quote" };
    if (!move.showsQuality.trim()) return { ok: false, reason: "missing quality" };
  }
  if (!reel.searchOffer?.startsWith("Want me to search for references on how ")) {
    return { ok: false, reason: "search offer pattern" };
  }
  return { ok: true };
}

export function highlightReelFor(input: {
  answer: string;
  concept: string;
}): HighlightReel {
  const answer = input.answer.toLowerCase();
  const known = KNOWN.find(
    (item) =>
      item.concept === input.concept.toLowerCase() &&
      item.names.some((name) => answer.includes(name)),
  );
  const mentioned =
    input.answer.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/)?.[0] ??
    input.answer.trim();

  if (!known || known.confidence < 0.6) {
    return {
      instance: mentioned,
      concept: input.concept,
      moves: [],
      confidence: known?.confidence ?? 0,
      toVerify: true,
      dropped: true,
      line: `I don't know enough about ${mentioned} to say. Want me to look?`,
      searchOffer: null,
    };
  }

  const reel: HighlightReel = {
    instance: known.shortName,
    concept: input.concept,
    moves: known.moves,
    confidence: known.confidence,
    toVerify: true,
    dropped: false,
    line: `${known.shortName} is often discussed as a ${conceptRolePhrase(input.concept)}. Check it yourself.`,
    searchOffer: searchOffer(known.shortName, input.concept),
  };
  return reel;
}

export type SeededLead = {
  name: string;
  origin: "student_added";
  status: "to_verify";
  countsTowardCap: false;
  concept: string;
};

export function seedLeadFromHighlight(reel: HighlightReel): SeededLead | null {
  if (reel.dropped || !reel.searchOffer) return null;
  return {
    name: reel.instance,
    origin: "student_added",
    status: "to_verify",
    countsTowardCap: false,
    concept: reel.concept,
  };
}
