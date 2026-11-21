import { describe, expect, it } from "vitest";
import { mutateCookie, setAllServerCookies } from "@/lib/supabase/server-cookies";

const RSC_COOKIE_ERROR =
  "Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options";

describe("server component cookie writes", () => {
  it("swallows setAll when Next.js rejects the write", () => {
    expect(() =>
      setAllServerCookies(
        () => {
          throw new Error(RSC_COOKIE_ERROR);
        },
        [{ name: "sb-access-token", value: "refreshed" }],
      ),
    ).not.toThrow();
  });

  it("still writes when the cookie store allows it", () => {
    const written: string[] = [];
    setAllServerCookies(
      (cookie) => {
        written.push(`${cookie.name}=${cookie.value}`);
      },
      [{ name: "sb-access-token", value: "ok" }],
    );
    expect(written).toEqual(["sb-access-token=ok"]);
  });

  it("swallows a demo-cookie delete from a Server Component", () => {
    expect(() =>
      mutateCookie(() => {
        throw new Error(RSC_COOKIE_ERROR);
      }),
    ).not.toThrow();
  });
});
