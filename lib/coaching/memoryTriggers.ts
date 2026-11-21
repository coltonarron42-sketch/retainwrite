// SOP: coaching only, never generate submission text

import { wordCount } from "@/lib/utils";

export type TriggerSensitivity = "light" | "medium";

export type MemoryTrigger = {
  id: string;
  label: string;
  line: string;
  sensitivity: TriggerSensitivity;
  themes: string[];
};

/**
 * Scripted bank (stage specs 2B.8). Lines are verbatim.
 * The t47 yes/no openers are retired. family_job is Colton's model line.
 */
export const MEMORY_TRIGGERS: readonly MemoryTrigger[] = [
  {
    id: "first_time",
    label: "A first time",
    line: "Maybe you tried something for the first time. Would you like to tell me about it so we can see how it might fit your paper?",
    sensitivity: "light",
    themes: ["first", "general"],
  },
  {
    id: "best_day",
    label: "A day you didn't want to end",
    line: "Maybe there was a day you didn't want to end. Would you like to share a little about it so we can explore how it might shape your paper?",
    sensitivity: "light",
    themes: ["vacation", "general"],
  },
  {
    id: "someone_new",
    label: "Someone new",
    line: "Maybe you met someone who stuck with you. Want to tell me about them so we can see where they might fit in your paper?",
    sensitivity: "light",
    themes: ["family", "school", "general"],
  },
  {
    id: "plan_sideways",
    label: "A plan that went sideways",
    line: "Maybe a plan went sideways and turned into a story. Would you like to walk me through it so we can see how it might help your paper?",
    sensitivity: "light",
    themes: ["challenge", "vacation", "general"],
  },
  {
    id: "small_milestone",
    label: "A little milestone",
    line: "Maybe you had a little milestone, like losing a tooth. Would you like to share it so we can see how it might add to your paper?",
    sensitivity: "light",
    themes: ["school", "first", "general"],
  },
  {
    id: "new_place",
    label: "A new place",
    line: "Maybe you visited somewhere new, even close to home. Would you like to describe it so we can explore how it fits your paper?",
    sensitivity: "light",
    themes: ["vacation", "change", "general"],
  },
  {
    id: "new_skill",
    label: "Something you learned",
    line: "Maybe you learned something new or got better at something. Want to tell me about it so we can see how it might help your paper?",
    sensitivity: "light",
    themes: ["school", "first", "general"],
  },
  {
    id: "small_moment",
    label: "A small moment",
    line: "Maybe there's a small moment that still makes you smile. Would you like to share it so we can see if it belongs in your paper?",
    sensitivity: "light",
    themes: ["vacation", "family", "general"],
  },
  {
    id: "moved",
    label: "A move or a new school",
    line: "Maybe you moved houses or changed schools. Would you like to share what that was like so we can explore how it might fit your paper?",
    sensitivity: "light",
    themes: ["change", "school", "family"],
  },
  {
    id: "got_hurt",
    label: "Getting hurt",
    line: "Maybe you got hurt, like breaking a bone, and it changed your plans. If you're comfortable, would you like to share it so we can explore how it might shape your paper?",
    sensitivity: "medium",
    themes: ["challenge", "change"],
  },
  {
    id: "family_job",
    label: "A family job change",
    line: "A family member started or lost a job. Do you want to expand on it so we can explore how it might help your paper?",
    sensitivity: "medium",
    themes: ["family", "change"],
  },
] as const;

export const MEMORY_TRIGGER_INTRO =
  "Just ideas to jog your memory. Pick one, or skip any that don't fit. Only share what you're comfortable sharing.";

export const SCRIPTED_MEMORY_FOLLOW_UP =
  "Thank you. Whenever you're ready, tell me what you remember most, and we'll look at how it fits your paper.";

export const HEAVY_DEFLECTION =
  "Thank you for sharing that. You can write about it or pick a different moment; both are okay.";

export const MEMORY_SAFETY_NOTE =
  "If you're hurting, tell a trusted adult. In the US you can call or text 988, the Suicide & Crisis Lifeline. We'll pause this section here.";

const OPENING_AUX =
  /^(did|do|does|have|has|had|were|was|is|are|can|could|will|would)\b/i;

const INVITATIONS = [
  "Would you like",
  "Do you want to",
  "Want to",
  "If you're comfortable",
] as const;

const PRESSURE =
  /\b(must|have to|need to|exactly|everything|why didn't)\b/i;

const BANNED_TOPIC =
  /\b(death|died|dying|abuse|abused|illness|violence|divorce|self-harm|suicide)\b/i;

const RISK =
  /\b(kill myself|suicide|self-harm|want to die|being abused|hits me|hurt myself)\b/i;

export function assertGentleInvitation(line: string): { ok: true } | { ok: false; reason: string } {
  const text = line.trim();
  if (OPENING_AUX.test(text)) {
    return { ok: false, reason: "opens with a yes/no question" };
  }
  if (!INVITATIONS.some((phrase) => text.includes(phrase))) {
    return { ok: false, reason: "missing an invitation" };
  }
  if (!/your paper|\{term\}/i.test(text)) {
    return { ok: false, reason: "missing a link back to the paper" };
  }
  if (!text.endsWith("?")) {
    return { ok: false, reason: "must end with a question mark" };
  }
  if (wordCount(text) > 35) {
    return { ok: false, reason: "over 35 words" };
  }
  if (PRESSURE.test(text)) {
    return { ok: false, reason: "pressure wording" };
  }
  if (BANNED_TOPIC.test(text)) {
    return { ok: false, reason: "banned topic" };
  }
  return { ok: true };
}

export function triggerMatchesBannedTopic(trigger: MemoryTrigger): boolean {
  return BANNED_TOPIC.test(`${trigger.label} ${trigger.line}`);
}

export function acceptMemoryFollowUp(modelLine: string): { line: string; rejected: boolean } {
  const text = modelLine.trim();
  const opensOnYou = /^(did|do|does|have|has|had|were|was|is|are|can|could|will|would)\s+you\b/i.test(
    text,
  );
  if (opensOnYou || !assertGentleInvitation(text).ok) {
    return { line: SCRIPTED_MEMORY_FOLLOW_UP, rejected: true };
  }
  return { line: text, rejected: false };
}

export function safetyNoteFor(answer: string): {
  show: boolean;
  note: string;
  event: "memory_safety_note_shown";
  detail: Record<string, never>;
} {
  const show = RISK.test(answer);
  return {
    show,
    note: show ? MEMORY_SAFETY_NOTE : "",
    event: "memory_safety_note_shown",
    detail: {},
  };
}

export function triggersForStudent(input: {
  under18: boolean;
  hiddenIds?: string[];
  refresh?: number;
  theme?: string;
}): MemoryTrigger[] {
  const hidden = new Set(input.hiddenIds ?? []);
  const refresh = Math.min(3, Math.max(0, input.refresh ?? 0));
  const theme = input.theme?.toLowerCase();
  const pool = MEMORY_TRIGGERS.filter((trigger) => {
    if (hidden.has(trigger.id)) return false;
    if (input.under18 && trigger.sensitivity === "medium") return false;
    if (refresh === 0 && trigger.sensitivity === "medium") return false;
    return true;
  });
  const themed = theme
    ? [
        ...pool.filter((trigger) => trigger.themes.includes(theme)),
        ...pool.filter((trigger) => !trigger.themes.includes(theme)),
      ]
    : [...pool];
  const start = refresh * 4;
  return themed.slice(start, start + 4);
}
