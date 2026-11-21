import Link from "next/link";

const STAGES = [
  { n: "01", title: "Intake", copy: "Capture the assignment and your natural voice." },
  { n: "02", title: "Stance", copy: "Face counterarguments in your own words." },
  { n: "03", title: "Outline", copy: "Build structure with claims and evidence notes." },
  { n: "04", title: "Sources", copy: "Turn readings into study beats you can reuse." },
  { n: "05", title: "Drafting", copy: "Write section by section — you type every sentence." },
  { n: "06", title: "Revise", copy: "Checklist coaching that keeps your voice intact." },
];

export function HowItWorks() {
  return (
    <section className="border-t border-rw-ink/10 bg-rw-paper px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-3xl text-rw-ink md:text-4xl">
          Six gated stages. One job each.
        </h2>
        <p className="mt-3 max-w-2xl text-rw-ink/65">
          You cannot skip ahead. Thin answers get a probe. The coach asks;
          you write.
        </p>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage) => (
            <li key={stage.n} className="border-t border-rw-ink/15 pt-4">
              <p className="font-mono text-xs tracking-widest text-rw-teal">
                {stage.n}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-rw-ink">
                {stage.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-rw-ink/65">
                {stage.copy}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-14 max-w-2xl text-base text-rw-ink/70">
          Your first paper is free, no card needed. After that, pay per paper or
          grab a 3-pack to save. Want to listen to your sources instead of
          rereading them? Add audio for $1.99, or get it included with any pack.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block text-sm font-semibold text-rw-teal underline-offset-4 hover:underline"
        >
          Pay per paper. No subscription. →
        </Link>
      </div>
    </section>
  );
}
