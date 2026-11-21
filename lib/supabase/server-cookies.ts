export type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/**
 * Cookie writes from a Server Component throw in Next.js.
 * Swallow that error; proxy.ts refreshes the session where writes are allowed.
 */
export function setAllServerCookies(
  setCookie: (cookie: CookieToSet) => void,
  cookiesToSet: CookieToSet[],
): void {
  try {
    for (const cookie of cookiesToSet) setCookie(cookie);
  } catch {
    // Server Component render. The proxy refreshes auth cookies.
  }
}

export function mutateCookie(write: () => void): void {
  try {
    write();
  } catch {
    // Same restriction as setAll: only proxy, Route Handlers, and Server Actions.
  }
}
