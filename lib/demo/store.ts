import { initialStageProgress } from "@/lib/stages/assert";
import type { StyleMetrics } from "@/lib/style/metrics";

export type DemoProfile = {
  free_paper_used: boolean;
  paper_credits: number;
  email: string;
  display_name: string;
};

export type DemoPaper = {
  id: string;
  title: string | null;
  course: string | null;
  due_date: string | null;
  assignment_prompt: string | null;
  required_length: string | null;
  citation_style: string | null;
  is_free_paper: boolean;
  funded_by: "single" | "pack3" | "audio" | null;
  audio_unlocked: boolean;
  current_stage: number;
  stage_progress: {
    stage: number;
    status: "locked" | "in_progress" | "complete";
    data: Record<string, unknown>;
  }[];
  style_profile?: StyleMetrics & { raw_sample: string };
};

export type DemoPurchase = {
  id: string;
  kind: "single" | "pack3" | "audio";
  amount_cents: number;
  status: "pending" | "paid" | "failed" | "refunded";
  created_at: string;
};

const PROFILE_KEY = "rw_demo_profile";
const PAPERS_KEY = "rw_demo_papers";
const PURCHASES_KEY = "rw_demo_purchases";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getDemoProfile(): DemoProfile {
  if (!canUseStorage()) {
    return {
      free_paper_used: false,
      paper_credits: 0,
      email: "demo@retainwrite.com",
      display_name: "Demo Student",
    };
  }
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) {
    const profile: DemoProfile = {
      free_paper_used: false,
      paper_credits: 0,
      email: "demo@retainwrite.com",
      display_name: "Demo Student",
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }
  return JSON.parse(raw) as DemoProfile;
}

export function saveDemoProfile(profile: DemoProfile) {
  if (!canUseStorage()) return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function listDemoPapers(): DemoPaper[] {
  if (!canUseStorage()) return [];
  const raw = localStorage.getItem(PAPERS_KEY);
  return raw ? (JSON.parse(raw) as DemoPaper[]) : [];
}

export function saveDemoPapers(papers: DemoPaper[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(PAPERS_KEY, JSON.stringify(papers));
}

export function getDemoPaper(id: string): DemoPaper | undefined {
  return listDemoPapers().find((p) => p.id === id);
}

export function upsertDemoPaper(paper: DemoPaper) {
  const papers = listDemoPapers();
  const idx = papers.findIndex((p) => p.id === paper.id);
  if (idx >= 0) papers[idx] = paper;
  else papers.unshift(paper);
  saveDemoPapers(papers);
}

export function createDemoPaper(opts?: {
  funded_by?: DemoPaper["funded_by"];
  is_free_paper?: boolean;
  audio_unlocked?: boolean;
}): DemoPaper {
  const paper: DemoPaper = {
    id: crypto.randomUUID(),
    title: null,
    course: null,
    due_date: null,
    assignment_prompt: null,
    required_length: null,
    citation_style: null,
    is_free_paper: opts?.is_free_paper ?? false,
    funded_by: opts?.funded_by ?? null,
    audio_unlocked: opts?.audio_unlocked ?? false,
    current_stage: 1,
    stage_progress: initialStageProgress().map((s) => ({
      ...s,
      data: {},
    })),
  };
  upsertDemoPaper(paper);
  return paper;
}

export function listDemoPurchases(): DemoPurchase[] {
  if (!canUseStorage()) return [];
  const raw = localStorage.getItem(PURCHASES_KEY);
  return raw ? (JSON.parse(raw) as DemoPurchase[]) : [];
}

export function addDemoPurchase(purchase: DemoPurchase) {
  if (!canUseStorage()) return;
  const list = listDemoPurchases();
  list.unshift(purchase);
  localStorage.setItem(PURCHASES_KEY, JSON.stringify(list));
}
