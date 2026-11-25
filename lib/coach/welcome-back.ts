/**
 * PC-28 (Colton t185u): every return opens a clean chat. Pau says ONE line,
 * picked at random, that means "we made progress: keep going, or check the
 * progress?" with the real last-locked piece ({done}) and the next one ({next}).
 * Casual, a little slangy, student-safe, in her voice. Then the student is back
 * on the exact prompt they were on.
 */
export const WELCOME_BACK_TEMPLATES = [
  // QA 3:26 AM #2: statements only. The left-off prompt below is the one question on screen;
  // "See skeleton" under this line is the way to check the progress.
  "What's crackin. We finished {done}, so {next} is up. Your progress is in the skeleton anytime.",
  "Look who's back. {Done} is in the bag, and {next} is next. Peek at the progress whenever.",
  "Yo, welcome back. We wrapped {done}. {Next} is up, and the progress is one tap away.",
  "Hey hey. {Done} is done and dusted. Next up is {next}. The progress is in your skeleton.",
  "You're back, love that. We locked in {done}. Straight on to {next}, progress whenever you want it.",
  "Welcome back, legend. {Done}: handled. {Next} is up next, and the progress is right there.",
  "Ayy, you're back. We knocked out {done}. {Next} is up, and your progress is saved.",
  "Sup. Quick recap: {done} is finished, {next} is next. The skeleton shows how far we've come.",
  "Back at it. {Done} is locked, so {next} is up. The progress is in the skeleton.",
  "Well, well, well. We crushed {done}. On to {next}, and the progress is a tap away.",
  "Hey, good to see you. {Done} is wrapped up. {Next} is up, progress whenever you want a look.",
  "Oh hey. Last time we finished {done}. We pick up with {next}, and the progress is saved.",
  "Welcome back. We're cooking: {done} is done. {Next} is up, progress in the skeleton.",
  "Back at it. {Done} is in the books. Keep the streak going with {next}. Progress is one tap away.",
  "Hey, you came back. {Done} is done. {Next} is up, and your progress so far is in the skeleton.",
  "Look at you showing up. We finished {done}. Next stop: {next}. The progress is right there.",
  "Yo. {Done} is locked and loaded. {Next} is up now, and the progress is a tap away.",
  "Welcome back. We got {done} squared away. Rolling into {next}, progress whenever.",
  "Heyyy. We're making moves: {done} is done. {Next} is up. Your progress is saved.",
  "Hi again. {Done} is finished, no take-backs needed. Straight into {next}, progress in the skeleton.",
  "Back already. Love the hustle. We wrapped {done}. Onward to {next}, the progress is right there.",
  "Hey. Good news: {done} is done. {Next} is up, and you can peek at the progress anytime.",
  "What's good. We nailed down {done}. {Next} is up, and the progress so far is in the skeleton.",
  "Okay, we're back in business. {Done} is wrapped. On to {next}, progress one tap away.",
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

/** A random template index that is never the one used last time (no repeat on reload). */
export function freshWelcomeIndex(last: number | null, rand: number = Math.random()): number {
  const n = WELCOME_BACK_TEMPLATES.length;
  if (last === null || last < 0 || last >= n) return Math.floor(rand * n) % n;
  const j = Math.floor(rand * (n - 1)) % (n - 1);
  return j >= last ? j + 1 : j;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TEMPLATE_RES = WELCOME_BACK_TEMPLATES.map(
  (t) => new RegExp(`^${esc(t).replace(/\\\{(done|Done|next|Next)\\\}/g, ".{1,120}?")}$`),
);

/**
 * PC-30 QA #4: on a finished stage (read-only look back) she never says "rolling into" a section
 * or that work is up next there: the stage is done and saved, the live work is elsewhere.
 */
export function reviewWelcomeLine(stage: number, label: string | null | undefined, paperStage: number): string {
  const name = (label ?? "").trim();
  const which = name ? `Stage ${stage}, ${name},` : `Stage ${stage}`;
  const live = paperStage > stage ? ` Your work picks up in Stage ${paperStage}.` : "";
  return `Welcome back. ${which} is done, so this is a read-only look back at what you saved.${live}`;
}
const REVIEW_RE = /^Welcome back\. Stage \d+(, [^,]{1,40},)? is done, so this is a read-only look back at what you saved\.( Your work picks up in Stage \d+\.)?$/;

/** True for a filled welcome-back line (voice: the restore hold lets only this through). */
export function isWelcomeLine(text: string): boolean {
  const t = text.trim();
  return TEMPLATE_RES.some((re) => re.test(t)) || REVIEW_RE.test(t);
}

/** Short labels for the fill: "the Introduction" style, never a sentence. */
export function sectionLabel(title: string | null | undefined): string {
  const t = (title ?? "").trim();
  if (!t) return "";
  return /^(the|your)\b/i.test(t) ? t : `the ${t}`;
}
