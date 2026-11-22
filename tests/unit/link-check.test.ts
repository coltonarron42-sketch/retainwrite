import { describe, expect, it } from "vitest";
import { checkLink, isPrivateAddress } from "@/lib/assignment/link-check";

describe("link check", () => {
  it("rejects made-up and private hosts without a request", async () => {
    expect(await checkLink("https://not-a-real-site-xyz123.invalid/article")).toEqual({ ok: false, reason: "dns" });
    expect(await checkLink("http://127.0.0.1/admin")).toEqual({ ok: false, reason: "private" });
    expect(await checkLink("not a link")).toEqual({ ok: false, reason: "invalid" });
    expect(isPrivateAddress("10.0.0.8")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});
