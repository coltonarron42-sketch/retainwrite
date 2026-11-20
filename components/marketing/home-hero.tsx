import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HomeHero() {
  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-hero-atmosphere"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.35] mix-blend-multiply [background-image:url('/paper-grain.svg')] [background-size:280px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full md:w-[58%]"
      >
        <div className="hero-notebook absolute inset-0 animate-drift" />
      </div>

      <div className="mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 md:justify-center md:px-8 md:pb-24 md:pt-24">
        <div className="max-w-xl animate-rise">
          <p className="font-display text-5xl leading-[0.95] tracking-tight text-rw-ink sm:text-6xl md:text-7xl">
            RetainWrite
          </p>
          <h1 className="mt-5 max-w-md text-2xl font-semibold leading-snug text-rw-ink/90 md:text-3xl">
            Write your paper. Keep the learning.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-rw-ink/70 md:text-lg">
            A coaching path through six stages — questions, feedback, and study
            beats — without ever writing the submission for you.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">Start your first paper free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
