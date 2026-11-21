import { voiceNudgeStats } from "@/lib/coaching/sop";

const EMPTY = voiceNudgeStats([]);

export default function AdminSopPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-4xl text-rw-ink">SOP review</h1>
      <section className="mt-8 rounded-2xl bg-white p-5">
        <h2 className="font-display text-2xl">Voice nudge</h2>
        <p className="mt-2 text-sm text-rw-ink/70">
          Nudge rate and the split between rework and keep come from voice_nudge_shown,
          voice_nudge_rework_opened, and voice_nudge_kept.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-rw-ink/50">Shown</dt>
            <dd className="text-2xl">{EMPTY.shown}</dd>
          </div>
          <div>
            <dt className="text-rw-ink/50">Rework</dt>
            <dd className="text-2xl">{EMPTY.reworkOpened}</dd>
          </div>
          <div>
            <dt className="text-rw-ink/50">Keep</dt>
            <dd className="text-2xl">{EMPTY.kept}</dd>
          </div>
        </dl>
      </section>
      <section className="mt-6 rounded-2xl bg-white p-5">
        <h2 className="font-display text-2xl">Logic checkpoints</h2>
        <p className="mt-2 text-sm text-rw-ink/70">
          logic_strong_continued stays on the review list. Continuing never blocks the student.
        </p>
      </section>
    </main>
  );
}
