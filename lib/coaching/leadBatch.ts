// SOP: coaching only, never generate submission text

import {
  RESEARCH_LEADS_MAX_PER_PAPER,
  SEARCH_PROMPT_MAX_WORDS,
} from "@/lib/config";
import { wordCount } from "@/lib/utils";

export const CONTROVERSY_NOTES = [
  "although controversial",
  "a debated figure",
  "with a mixed record",
] as const;

export type ControversyNote = (typeof CONTROVERSY_NOTES)[number];

export type LeadCandidate = {
  name: string;
  rubricMatch: number;
  rubricRef: string;
  lessonLink: string;
  whyFits: string;
  interestSteered?: boolean;
  studentNamed?: boolean;
  isWildcard?: boolean;
  wildcardWhy?: string;
  controversyNote?: string | null;
  familyFriendly?: boolean;
  safetyFlags?: string[];
};

export type PreparedLead = LeadCandidate & {
  rank: number | null;
  isWildcard: boolean;
  origin: "ai_suggested" | "student_added";
  preselected: false;
  status: "to_verify";
};

export type LeadBatch = {
  ranked: PreparedLead[];
  wildcard: PreparedLead | null;
  capReached: boolean;
  trimmedWildcard: boolean;
  omittedWildcardReason: string | null;
  rejectedExtra: boolean;
};

export function controversyAllowed(note: string | null | undefined): boolean {
  if (note == null || note === "") return true;
  return (CONTROVERSY_NOTES as readonly string[]).includes(note);
}

export function wildcardIsSafe(
  wildcard: LeadCandidate,
  under18: boolean,
): { ok: true } | { ok: false; reason: string } {
  if (!wildcard.wildcardWhy?.trim()) {
    return { ok: false, reason: "missing wildcard why" };
  }
  if (!controversyAllowed(wildcard.controversyNote)) {
    return { ok: false, reason: "controversy note not allowed" };
  }
  if ((wildcard.safetyFlags?.length ?? 0) > 0) {
    return { ok: false, reason: "safety filter" };
  }
  if (under18 && wildcard.familyFriendly === false) {
    return { ok: false, reason: "not family friendly" };
  }
  return { ok: true };
}

export function assertCanAddAiLead(aiSuggestedSoFar: number): void {
  if (aiSuggestedSoFar >= RESEARCH_LEADS_MAX_PER_PAPER) {
    throw new Error("Research lead cap reached");
  }
}

function byRank(a: LeadCandidate, b: LeadCandidate): number {
  if (b.rubricMatch !== a.rubricMatch) return b.rubricMatch - a.rubricMatch;
  if (Boolean(b.interestSteered) !== Boolean(a.interestSteered)) {
    return Number(Boolean(b.interestSteered)) - Number(Boolean(a.interestSteered));
  }
  return Number(Boolean(b.studentNamed)) - Number(Boolean(a.studentNamed));
}

export function assembleLeadBatch(input: {
  candidates: LeadCandidate[];
  wildcard: LeadCandidate | null;
  aiSuggestedSoFar: number;
  under18?: boolean;
}): LeadBatch {
  const remaining = RESEARCH_LEADS_MAX_PER_PAPER - input.aiSuggestedSoFar;
  if (remaining <= 0) {
    return {
      ranked: [],
      wildcard: null,
      capReached: true,
      trimmedWildcard: Boolean(input.wildcard),
      omittedWildcardReason: input.wildcard ? "cap" : null,
      rejectedExtra: true,
    };
  }

  const sorted = [...input.candidates].sort(byRank);
  let wildcard: PreparedLead | null = null;
  let trimmedWildcard = false;
  let omittedWildcardReason: string | null = null;

  if (input.wildcard) {
    const safe = wildcardIsSafe(input.wildcard, Boolean(input.under18));
    if (!safe.ok) {
      omittedWildcardReason = safe.reason;
      trimmedWildcard = true;
    } else if (remaining <= sorted.length && remaining <= 5) {
      trimmedWildcard = true;
      omittedWildcardReason = "cap";
    }
  }

  const wildcardSlot =
    input.wildcard && !trimmedWildcard && omittedWildcardReason == null ? 1 : 0;
  const rankedRoom = Math.min(5, sorted.length, remaining - wildcardSlot);
  const ranked = sorted.slice(0, Math.max(0, rankedRoom)).map((lead, index) => ({
    ...lead,
    rank: index + 1,
    isWildcard: false as const,
    origin: "ai_suggested" as const,
    preselected: false as const,
    status: "to_verify" as const,
  }));

  if (input.wildcard && !trimmedWildcard && omittedWildcardReason == null && ranked.length + 1 <= remaining) {
    wildcard = {
      ...input.wildcard,
      rank: null,
      isWildcard: true,
      origin: "ai_suggested",
      preselected: false,
      status: "to_verify",
    };
  }

  const shown = ranked.length + (wildcard ? 1 : 0);
  return {
    ranked,
    wildcard,
    capReached: input.aiSuggestedSoFar + shown >= RESEARCH_LEADS_MAX_PER_PAPER,
    trimmedWildcard,
    omittedWildcardReason,
    rejectedExtra: false,
  };
}

export function guardLeadBatch(batch: LeadBatch): { ok: true } | { ok: false; reason: string } {
  const wildcards = batch.wildcard ? 1 : 0;
  if (wildcards > 1) return { ok: false, reason: "more than one wildcard" };
  if (batch.ranked.length > 5) return { ok: false, reason: "more than 5 ranked leads" };
  for (const lead of batch.ranked) {
    if (lead.preselected) return { ok: false, reason: "ranked lead preselected" };
    if (lead.isWildcard) return { ok: false, reason: "ranked lead marked wildcard" };
  }
  if (batch.wildcard) {
    if (batch.wildcard.preselected) return { ok: false, reason: "wildcard preselected" };
    if (!batch.wildcard.wildcardWhy) return { ok: false, reason: "wildcard why missing" };
    if (!controversyAllowed(batch.wildcard.controversyNote)) {
      return { ok: false, reason: "controversy note" };
    }
  }
  const matches = batch.ranked.map((lead) => lead.rubricMatch);
  const sorted = [...matches].sort((a, b) => b - a);
  if (matches.some((value, index) => value !== sorted[index])) {
    return { ok: false, reason: "not ranked by rubric match" };
  }
  return { ok: true };
}

export function buildGoogleSearchPrompt(input: {
  section: string;
  rubricTerms: string[];
  storyAngle: string;
}): string {
  const raw = [input.section, ...input.rubricTerms, input.storyAngle, "sources to verify"]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
  return raw.slice(0, SEARCH_PROMPT_MAX_WORDS).join(" ");
}

export function searchPromptWithinCap(prompt: string): boolean {
  return wordCount(prompt) <= SEARCH_PROMPT_MAX_WORDS;
}

export function countAiLeads(leads: { origin: string }[]): number {
  return leads.filter((lead) => lead.origin === "ai_suggested").length;
}
