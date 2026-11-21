"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceNote } from "@/components/coaching/voice-note";
import { checkerVoiceReport } from "@/lib/checker/report";
import { usePasteMeta } from "@/lib/hooks/use-paste-meta";
import { computeStyleMetrics } from "@/lib/style/metrics";
import { wordCount } from "@/lib/utils";

const words = (text: string) => wordCount(text);

export function CheckerTool() {
  const [draft, setDraft] = useState("");
  const [sample, setSample] = useState("");
  const [showSample, setShowSample] = useState(false);
  const [full, setFull] = useState(false);
  const draftPaste = usePasteMeta();
  const samplePaste = usePasteMeta();

  const report = full
    ? checkerVoiceReport({
        sampleText: sample,
        sampleMeta: {
          pastedChars: samplePaste.meta.pastedChars,
          typedChars: samplePaste.meta.typedChars,
        },
        preview: false,
      })
    : null;
  const metrics = draft.trim() ? computeStyleMetrics(draft) : null;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-28">
      <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">RetainWrite</p>
      <h1 className="mt-3 font-display text-4xl text-rw-ink md:text-5xl">
        AI Detector for Student Papers: Does It Sound Like You?
      </h1>
      <p className="mt-4 max-w-2xl text-rw-ink/75">
        Signal strength describes how strongly a pattern shows up. It is not a verdict and not a percent chance that a tool wrote the draft.
      </p>
      <label className="mt-8 block text-sm font-medium" htmlFor="checker-draft">
        Your draft
      </label>
      <Textarea
        id="checker-draft"
        className="mt-2 min-h-48"
        value={draft}
        onPaste={draftPaste.onPaste}
        onDrop={draftPaste.onDrop}
        onChange={(event) => {
          draftPaste.onChange(draft, event.target.value);
          setDraft(event.target.value);
        }}
      />
      <p className="mt-1 text-xs text-rw-ink/50">{words(draft)} words</p>
      <button
        type="button"
        className="mt-4 text-sm font-semibold text-rw-teal"
        onClick={() => setShowSample((open) => !open)}
      >
        Add a sample of your own writing (optional)
      </button>
      {showSample ? (
        <div className="mt-3">
          <label className="text-sm font-medium" htmlFor="checker-sample">
            Writing sample
          </label>
          <Textarea
            id="checker-sample"
            className="mt-2 min-h-32"
            value={sample}
            onPaste={samplePaste.onPaste}
            onDrop={samplePaste.onDrop}
            onChange={(event) => {
              samplePaste.onChange(sample, event.target.value);
              setSample(event.target.value);
            }}
          />
        </div>
      ) : null}
      <Button type="button" className="mt-6" onClick={() => setFull(true)} disabled={words(draft) < 20}>
        Check signal strength
      </Button>
      {full && metrics ? (
        <article className="mt-8 rounded-2xl bg-white p-5">
          <h2 className="font-display text-2xl">Signal strength</h2>
          <p className="mt-2 text-sm text-rw-ink/70">
            Average sentence length {metrics.avgSentenceLength.toFixed(1)} words. Reading grade{" "}
            {metrics.readingGrade.toFixed(1)}.
          </p>
          <p className="mt-4 text-sm text-rw-ink/80">
            No detector can prove who wrote a draft. Formal writing and students still learning English are misread most often. See Liang et al. (2023), Patterns 4(7), 100779.
          </p>
          <VoiceNote note={report?.note ?? null} />
        </article>
      ) : null}
    </div>
  );
}
