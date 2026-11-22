import Link from "next/link";

/**
 * Homepage in the PLAN.md section 8 Editorial-Warm system.
 * Copy sources (PLAN.md unless noted):
 * - Headline: 8.5 example headline, line 113.
 * - Subhead: section 1 product goal (line 7) + section 3 "we never write for you" promise (line 19).
 * - Proof points: section 2 non-negotiables (lines 10–14).
 * - CTA: "Start free paper", lines 19 and 115; journey line 34.
 * - Stages: section 3, lines 23–28.
 * - Pricing blurb + link: retainwrite-cursor-build-prompt.md line 501 (locked homepage blurb).
 */

const PROOF_POINTS = [
  "You own every sentence.",
  "One question at a time.",
  "We teach a concept, then ask about it.",
  "Progress saves as you go. Leave and resume anytime.",
];

const STAGES = [
  {
    name: "Intake",
    copy: "Upload your assignment as photos, a PDF, or text. We pull out the prompt, format, rubric, and sections. You confirm them.",
  },
  {
    name: "Stance and research",
    copy: "Go section by section. Share what you already know. Get 3–5 research leads to explore, then confirm your ideas.",
  },
  {
    name: "Outline",
    copy: "Build a sentence-level outline from your own confirmed ideas. The coach supplies structure only.",
  },
  {
    name: "Sources",
    copy: "Review and select your research leads. Build references as you go.",
  },
  {
    name: "Drafting",
    copy: "Write every sentence from your outline. The coach offers example transitions and light cleanup flags.",
  },
  {
    name: "Revise",
    copy: "Check citations, flow, and voice. Export to Word or PDF.",
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
        <h1
          id="home-title"
          className="font-display text-[32px] font-semibold leading-[1.2] text-ds-ink"
        >
          Your paper, your words, every step
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-ds-muted">
          We coach you through a structured process so you learn and retain the material.
          We never write the paper for you.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href={startHref} className="ds-btn-primary">
            Start free paper
          </Link>
          <Link href="/pricing" className="ds-btn-ghost">
            See pricing
          </Link>
        </div>
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

      <section className="mx-auto mt-16 max-w-[1100px]" aria-labelledby="stages-title">
        <h2
          id="stages-title"
          className="mx-auto max-w-[680px] font-display text-[24px] font-semibold leading-[1.2] text-ds-ink md:max-w-none"
        >
          The six-stage coaching path
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage, index) => (
            <li
              key={stage.name}
              className="rounded-[12px] border border-ds-border bg-ds-surface p-8 shadow-ds-card"
            >
              <p className="text-[13px] font-semibold uppercase leading-[1.6] tracking-[0.08em] text-ds-muted">
                Stage {index + 1}
              </p>
              <h3 className="mt-2 font-display text-[20px] font-semibold leading-[1.2] text-ds-ink">
                {stage.name}
              </h3>
              <p className="mt-4 text-[16px] leading-[1.6] text-ds-muted">{stage.copy}</p>
            </li>
          ))}
        </ol>
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
