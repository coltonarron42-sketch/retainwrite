import { isSpokenYes } from "@/lib/stages/stance-turn";
import { test, expect } from "vitest";
test("y", () => {
  for (const t of ["Yes, lock it in.", "Yeah, sounds good!", "Okay lock it in", "yep", "Yes please, I'm happy with that.", "Let's go"]) expect([t, isSpokenYes(t)]).toEqual([t, true]);
  for (const t of ["No, don't lock it in", "Yes but change the ending", "Wait", "My brother sleeps in class", "Yes my brother is tired", "Not yet", "Hold on, yes"]) expect([t, isSpokenYes(t)]).toEqual([t, false]);
});
