/**
 * Joins voice-typing pieces into the box text: what was already typed, the
 * finished phrases, and the phrase still being heard. Some browsers (Android
 * Chrome) send phrases without a leading space, so a single space goes
 * between any two pieces that don't already have one. Spaces are tidied, and
 * nothing is ever put in front of the typed text.
 */
export function joinTranscript(base: string, finals: readonly string[], interim = ""): string {
  const pieces = [base, ...finals, interim].map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  return pieces.join(" ");
}
