// SOP: coaching only, never generate submission text

export type ReadbackFlag = {
  kind: "placement" | "weight" | "pacing" | "gap";
  text: string;
  ideaId: string;
  confidence: number;
};

export type ReadbackSignal = {
  ideaId: string;
  sectionKey: string;
  confidence: number;
  weight?: "light" | "ok" | "heavy";
  planRow?: number;
};

const PLACEMENT = "This idea might land better in";
const WEIGHT = "Your sentence";

export function shapeReadback(input: {
  ideas: { id: string; text: string; sectionKey: string }[];
  signals?: ReadbackSignal[];
}): { ideas: { id: string; text: string; sectionKey: string }[]; flags: ReadbackFlag[] } {
  const signals = (input.signals ?? []).filter((signal) => signal.confidence >= 0.7);
  const order = new Map(signals.map((signal, index) => [signal.ideaId, index]));
  const ideas = [...input.ideas].sort((a, b) => {
    const left = order.has(a.id) ? order.get(a.id)! : 100;
    const right = order.has(b.id) ? order.get(b.id)! : 100;
    return left - right;
  });
  const flags: ReadbackFlag[] = [];
  for (const signal of signals) {
    if (flags.length >= 2) break;
    const idea = input.ideas.find((item) => item.id === signal.ideaId);
    if (!idea) continue;
    if (signal.sectionKey !== idea.sectionKey) {
      flags.push({
        kind: "placement",
        ideaId: idea.id,
        confidence: signal.confidence,
        text: `${PLACEMENT} ${signal.sectionKey}.`,
      });
    } else if (signal.weight === "heavy" && signal.planRow) {
      flags.push({
        kind: "weight",
        ideaId: idea.id,
        confidence: signal.confidence,
        text: `${WEIGHT} ${signal.planRow} plan carries a lot; want to split that idea?`,
      });
    }
  }
  return { ideas, flags: flags.slice(0, 2) };
}
