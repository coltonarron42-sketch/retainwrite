export type ResearchLeadDraft = {
  name: string;
  whyAssignment: string;
  whyInterest?: string | null;
  resourceType?: string;
  url?: string;
  searchTerms?: string;
  status: "to_verify";
  steeredBy: "assignment" | "interest" | "both" | "student";
  source: "intake_suggestion" | "student";
  hookOrExampleNote?: string;
};

export function createLead(input: {
  name: string;
  whyAssignment: string;
  whyInterest?: string | null;
  steeredBy?: ResearchLeadDraft["steeredBy"];
  scholarlyRequired?: boolean;
  resourceType?: string;
}): ResearchLeadDraft {
  const steeredBy =
    input.steeredBy ??
    (input.whyInterest ? "both" : "assignment");

  if ((steeredBy === "interest" || steeredBy === "both") && !input.whyInterest?.trim()) {
    throw new Error("Interest-steered leads require a whyInterest line");
  }

  return {
    name: input.name.trim(),
    whyAssignment: input.whyAssignment.trim(),
    whyInterest: input.whyInterest?.trim() || null,
    resourceType: input.resourceType ?? "person",
    status: "to_verify",
    steeredBy,
    source: "intake_suggestion",
    ...(input.scholarlyRequired
      ? {
          hookOrExampleNote:
            "Use this as a hook or example — still pair it with a scholarly source for Stage 4.",
        }
      : {}),
  };
}

export function assertLeadDefaults(lead: ResearchLeadDraft): void {
  if (lead.status !== "to_verify") {
    throw new Error("New intake leads must default to to_verify");
  }
  if (
    (lead.steeredBy === "interest" || lead.steeredBy === "both") &&
    !lead.whyInterest?.trim()
  ) {
    throw new Error("Interest-steered leads require both why-lines");
  }
}
