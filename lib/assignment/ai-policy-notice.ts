import type { AssignmentRequirements } from "@/lib/assignment/schema";

const FORBID_PHRASES = [
  /\bno AI\b/i,
  /\bdo not use ChatGPT\b/i,
  /\bAI use is prohibited\b/i,
  /\bgenerative AI is not allowed\b/i,
  /\b(?:do not|don't|must not|may not)\s+use\s+AI\b/i,
];

export function needsAiPolicyAck(
  requirements: AssignmentRequirements,
  rawText?: string,
): boolean {
  const policy = requirements.aiPolicy.value;
  if (policy === "forbidden" || policy === "restricted") return true;
  if (rawText && FORBID_PHRASES.some((re) => re.test(rawText))) return true;
  return false;
}

export const AI_POLICY_NOTICE =
  "This assignment looks like it may restrict AI tools. RetainWrite is a coach — it doesn't write your paper — but your teacher may still not allow it. You decide whether to continue. If you're unsure, check with your teacher.";
