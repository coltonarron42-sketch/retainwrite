/**
 * PC-28 (Colton t185u): every return opens a clean chat. Pau Pau says ONE line,
 * picked at random, that means "we made progress: keep going, or check the
 * progress?" with the real last-locked piece ({done}) and the next one ({next}).
 * Casual, a little slangy, student-safe, in her voice. Then the student is back
 * on the exact prompt they were on.
 */
export const WELCOME_BACK_TEMPLATES = [
  "What's crackin? We finished {done}, so we can move right on to {next}, or you can check out the progress. What cha wanna do?",
  "Look who's back. {Done} is in the bag. Roll right into {next}, or peek at the progress first?",
  "Yo, welcome back. We wrapped {done}. Wanna jump into {next}, or check the progress?",
  "Hey hey. {Done} is done and dusted. Keep it moving with {next}, or take a look at the progress?",
  "You're back, love that. We locked in {done}. Straight to {next}, or a quick look at the progress?",
  "Welcome back, legend. {Done}: handled. {Next} is up next, or you can check the progress. Your call.",
  "Ayy, you're back. We knocked out {done}. Hop into {next}, or scope out the progress?",
  "Sup. Quick recap: {done} is finished. Wanna keep rolling with {next}, or check how far we've come?",
  "Back at it. {Done} is locked. Ready for {next}, or wanna peep the progress first?",
  "Well, well, well. We crushed {done}. On to {next}, or do you wanna see the progress?",
  "Hey, good to see you. {Done} is wrapped up. Keep going with {next}, or check the progress?",
  "Oh hey. Last time we finished {done}. Pick up with {next}, or take a peek at the progress?",
  "Welcome back. We're cooking: {done} is done. Slide into {next}, or check the progress?",
  "Back at it. {Done} is in the books. Keep the streak going with {next}, or look at the progress?",
  "Hey, you came back. {Done}? Done. Wanna tackle {next}, or check out the progress so far?",
  "Look at you showing up. We finished {done}. Next stop: {next}. Or wanna see the progress?",
  "Yo. {Done} is locked and loaded. Hit {next} now, or check the progress first?",
  "Welcome back. We got {done} squared away. Ready to roll into {next}, or wanna see the progress?",
  "Heyyy. We're making moves: {done} is done. Go for {next}, or check the progress?",
  "Hi again. {Done} is finished, no take-backs needed. Straight into {next}, or a look at the progress?",
  "Back already? Love the hustle. We wrapped {done}. Onward to {next}, or peek at the progress?",
  "Hey. Good news: {done} is done. Keep going with {next}, or check out the progress?",
  "What's good? We nailed down {done}. Wanna knock out {next}, or see the progress so far?",
  "Okay, we're back in business. {Done} is wrapped. On to {next}, or check the progress?",
] as const;

const SAMPLE_DONE = "idea 2";
const SAMPLE_NEXT = "idea 3";

export type WelcomeFill = { done: string | null; next: string };

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** One template filled in. {Done}/{Next} start a sentence (capitalized). */
export function fillWelcome(template: string, fill: WelcomeFill): string {
  const done = (fill.done ?? "").trim() || "a solid start";
  const next = fill.next.trim() || "the next step";
  return template
    .replace(/\{Done\}/g, cap(done))
    .replace(/\{done\}/g, done)
    .replace(/\{Next\}/g, cap(next))
    .replace(/\{next\}/g, next);
}

/** Every template, filled with a sample (tone and safety checks). */
export const WELCOME_BACK_LINES: readonly string[] = WELCOME_BACK_TEMPLATES.map((t) => fillWelcome(t, { done: SAMPLE_DONE, next: SAMPLE_NEXT }));

/** A random line for this return (index for tests). */
export function welcomeBackLine(fill: WelcomeFill, index?: number): { line: string; index: number } {
  const n = WELCOME_BACK_TEMPLATES.length;
  const i = index === undefined ? Math.floor(Math.random() * n) : ((index % n) + n) % n;
  return { line: fillWelcome(WELCOME_BACK_TEMPLATES[i]!, fill), index: i };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TEMPLATE_RES = WELCOME_BACK_TEMPLATES.map(
  (t) => new RegExp(`^${esc(t).replace(/\\\{(done|Done|next|Next)\\\}/g, ".{1,120}?")}$`),
);

/** True for a filled welcome-back line (voice: the restore hold lets only this through). */
export function isWelcomeLine(text: string): boolean {
  const t = text.trim();
  return TEMPLATE_RES.some((re) => re.test(t));
}

/** Short labels for the fill: "the Introduction" style, never a sentence. */
export function sectionLabel(title: string | null | undefined): string {
  const t = (title ?? "").trim();
  if (!t) return "";
  return /^(the|your)\b/i.test(t) ? t : `the ${t}`;
}
