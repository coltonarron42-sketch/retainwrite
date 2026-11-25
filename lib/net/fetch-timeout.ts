/**
 * QA 9:37 AM: a reply that stalls never leaves the chat hanging. The request is
 * aborted after `ms`, and the caller falls back (rules, a retry line) instead.
 */
export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
