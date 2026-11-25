import Link from "next/link";

/**
 * Homepage in the PLAN.md section 8 Editorial-Warm system.
 * Copy sources (PLAN.md unless noted):
 * - Headline: 8.5 example headline, line 113.
 * - Subhead: section 1 product goal (line 7) + section 3 "we never write for you" promise (line 19).
 * - Proof points: section 2 non-negotiables (lines 10–14).
 * - CTA: "Start free paper", lines 19 and 115; journey line 34.
 * - Hero, "we got you" lines, Guru line: Colton, Nov 24 12:18 AM (no public stage count).
 * - Pricing blurb + link: retainwrite-cursor-build-prompt.md line 501 (locked homepage blurb).
 */

const PROOF_POINTS = [
  "You own every sentence.",
  "One question at a time.",
  "We teach a concept, then ask about it.",
  "Progress saves as you go. Leave and resume anytime.",
];

/** Colton, Nov 24 12:18 AM: lead with the promise and meeting students where they are. */
const WE_GOT_YOU = [
  "Haven't opened the book and need to write a paper? We got you.",
  "Read the chapters, took notes, have a core idea and just want structure? We got you.",
];

const RESULTS = [
  {
    name: "A paper you own",
    copy: "Every sentence is yours, in your voice. You can stand behind it, explain it, and defend it.",
  },
  {
    name: "The learning, too",
    copy: "You work through the ideas instead of just submitting them, so you actually understand it and you're not lost when the test comes.",
  },
  {
    name: "A way of working you keep",
    copy: "Read the ask, get the gist, pick a direction, build it out. You'll start your next paper faster.",
  },
];

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="mt-[3px] h-5 w-5 shrink-0 text-ds-sage"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export function HomeEditorial({ startHref }: { startHref: string }) {
  return (
    <div className="px-6 py-12 md:px-16">
      {/* One frame: the promise and one primary action. */}
      <section className="mx-auto max-w-[680px] pt-8 md:pt-16" aria-labelledby="home-title">
        <p className="text-[13px] font-semibold uppercase leading-[1.6] tracking-[0.08em] text-ds-muted">
          Your writing Guru
        </p>
        <h1
          id="home-title"
          className="mt-2 font-display text-[32px] font-semibold leading-[1.2] text-ds-ink"
        >
          We meet you where you are
        </h1>
        <ul className="mt-6 space-y-3">
          {WE_GOT_YOU.map((line) => (
            <li key={line} className="flex gap-4 text-[18px] leading-[1.5] text-ds-ink">
              <CheckIcon />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[16px] leading-[1.6] text-ds-muted">
          Get the paper done, save time, and actually learn the material so you&apos;re not lost
          when the test comes. How long it takes depends on how prepared you are. Underneath is a
          simple, repeatable way of working you can use on your next paper too.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href={startHref} className="ds-btn-primary">
            Start free paper
          </Link>
          <Link href="/pricing" className="ds-btn-ghost">
            See pricing
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-[680px]" aria-labelledby="why-title">
        <h2 id="why-title" className="font-display text-[24px] font-semibold leading-[1.2] text-ds-ink">
          Why RetainWrite exists
        </h2>
        <p className="mt-4 text-[16px] leading-[1.6] text-ds-muted">
          Most writing help either leaves you alone with a blank page or does the work for you, and
          neither one teaches you anything. RetainWrite is the coach in between: it figures out what
          you already know, fills the gaps, and keeps you writing. You finish with a paper that&apos;s
          really yours, and you actually understand what you wrote. We never write the paper for you.
        </p>
      </section>

      <section className="mx-auto mt-16 max-w-[1100px]" aria-labelledby="results-title">
        <h2
          id="results-title"
          className="mx-auto max-w-[680px] font-display text-[24px] font-semibold leading-[1.2] text-ds-ink md:max-w-none"
        >
          What you walk away with
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {RESULTS.map((r) => (
            <li key={r.name} className="rounded-[12px] border border-ds-border bg-ds-surface p-8 shadow-ds-card">
              <h3 className="font-display text-[20px] font-semibold leading-[1.2] text-ds-ink">{r.name}</h3>
              <p className="mt-4 text-[16px] leading-[1.6] text-ds-muted">{r.copy}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-16 max-w-[680px]" aria-labelledby="how-title">
        <h2 id="how-title" className="font-display text-[24px] font-semibold leading-[1.2] text-ds-ink">
          How it works
        </h2>
        <p className="mt-4 text-[16px] leading-[1.6] text-ds-muted">
          Your coach, Pau, reads the assignment with you, catches you up on the material, and
          helps you pick a direction. Then you build the paper sentence by sentence while Pau
          asks the questions. You drive.
        </p>
        <ul className="mt-8 rounded-[12px] border border-ds-border bg-ds-surface p-8 shadow-ds-card">
          {PROOF_POINTS.map((point, index) => (
            <li
              key={point}
              className={`flex gap-4 text-[16px] leading-[1.6] text-ds-ink ${index > 0 ? "mt-4" : ""}`}
            >
              <CheckIcon />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-16 max-w-[680px]" aria-label="Pricing">
        <p className="text-[16px] leading-[1.6] text-ds-ink">
          Your first paper is free, no card needed. After that, pay per paper or grab a 3-pack to
          save. Want to listen to your sources instead of rereading them? Add audio for $1.99, or get
          it included with any pack.
        </p>
        <Link href="/pricing" className="ds-btn-ghost mt-4 -ml-2">
          Pay per paper. No subscription.
        </Link>
      </section>
    </div>
  );
}
