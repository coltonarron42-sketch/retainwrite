/**
 * Who is reading an assignment.
 * A signed-in student always wins over a leftover demo cookie.
 * Demo fallback is only for a real anonymous demo session.
 */
export type ReaderMode = "live" | "demo";

export function resolveReaderMode(input: {
  authenticated: boolean;
  demoSession: boolean;
}): ReaderMode {
  if (input.authenticated) return "live";
  if (input.demoSession) return "demo";
  return "live";
}
