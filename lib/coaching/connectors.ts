// SOP: coaching only, never generate submission text
// Display-only connector chips. Never inserted into the student's draft.

export const CONNECTOR_RELATIONS = [
  "time_moment",
  "sequence",
  "place_context",
  "build_on",
  "contrast",
  "cause_effect",
  "example",
  "zoom_out",
  "looking_back",
  "concluding",
] as const;

export type ConnectorRelation = (typeof CONNECTOR_RELATIONS)[number];

export const CONNECTORS: Record<ConnectorRelation, readonly string[]> = {
  time_moment: ["at this time", "in the beginning", "at first", "by then", "later that", "when"],
  sequence: ["first", "next", "after that", "from there", "finally"],
  place_context: ["where", "in that setting", "at that point", "within"],
  build_on: ["building on that", "in the same way", "also", "what's more"],
  contrast: ["however", "on the other hand", "by contrast", "even so", "yet"],
  cause_effect: ["because of this", "as a result", "so", "which led to", "this meant"],
  example: ["for example", "for instance", "such as", "one case is", "this shows"],
  zoom_out: ["overall", "more broadly", "this matters because", "stepping back"],
  looking_back: ["looking back", "in the end", "what I learned", "now I see"],
  concluding: ["in the end", "ultimately", "to close", "going forward"],
};

export function connectorChips(relation: ConnectorRelation): readonly string[] {
  return CONNECTORS[relation];
}

export function connectorWordCount(phrase: string): number {
  return phrase.trim().split(/\s+/).filter(Boolean).length;
}
