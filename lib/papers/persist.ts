import type { ResumePointer } from "@/lib/papers/resume";
import { markSignedOut, signedOut } from "@/lib/session/signedOut";

/** Wait for the server before the UI moves on. False means do not advance. */
export async function persistField(
  paperId: string,
  input: {
    fieldKey: string;
    text: string;
    submitted?: boolean;
    resume?: ResumePointer;
    session?: unknown;
  },
): Promise<boolean> {
  if (signedOut()) return false;
  try {
    const res = await fetch(`/api/papers/${paperId}/autosave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.resume ? { ...input, resume: { ...input.resume, at: input.resume.at ?? Date.now() } } : input),
      keepalive: true,
    });
    // Session gone: stop every later autosave instead of repeating the 401.
    if (res.status === 401) markSignedOut();
    return res.ok;
  } catch {
    return false;
  }
}
