import { describe, expect, it } from "vitest";
import { coerceDueDate, decidePaperFunding } from "@/lib/papers/funding";

describe("decidePaperFunding", () => {
  it("gives the first paper free and then spends a credit", () => {
    expect(decidePaperFunding({ free_paper_used: false, paper_credits: 0 }).ok).toBe(true);
    const spent = decidePaperFunding({ free_paper_used: true, paper_credits: 2 });
    expect(spent).toMatchObject({ ok: true, isFree: false, creditsAfter: 1 });
    expect(decidePaperFunding({ free_paper_used: true, paper_credits: 0 })).toEqual({
      ok: false,
      reason: "payment_required",
    });
  });
});

describe("coerceDueDate", () => {
  it("keeps real dates and drops text that is not a date", () => {
    expect(coerceDueDate("2026-05-01")).toBe("2026-05-01");
    expect(coerceDueDate("May 1, 2026")).toBe("2026-05-01");
    expect(coerceDueDate("Gittt words), double spaced")).toBeNull();
    expect(coerceDueDate(null)).toBeNull();
  });
});
