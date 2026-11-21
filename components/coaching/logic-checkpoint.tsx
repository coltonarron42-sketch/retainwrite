"use client";

import { Button } from "@/components/ui/button";
import {
  LOGIC_ALERT_LABEL,
  LOGIC_CONTINUE,
  LOGIC_MODERATE_TITLE,
  LOGIC_OPENER,
  LOGIC_PASS,
  LOGIC_STRONG_DETAIL,
  LOGIC_STRONG_HEADLINE,
  LOGIC_TWEAK,
  LOGIC_WRITER,
  LOGIC_YES,
} from "@/lib/coaching/logicCheck";

type Props = {
  phase: "opener" | "pass" | "moderate" | "strong";
  reason?: string;
  assignmentQuote?: string;
  questions?: string[];
  onContinue: () => void;
  onChoice: (choice: "yes" | "tweak" | "keep" | "adjust" | "new_angle" | "revise" | "reframe" | "continued") => void;
};

export function LogicCheckpoint({
  phase,
  reason,
  assignmentQuote,
  questions = [],
  onContinue,
  onChoice,
}: Props) {
  if (phase === "opener") {
    return (
      <section className="rounded-xl border border-rw-ink/15 bg-white p-4">
        <p className="font-medium text-rw-ink">{LOGIC_OPENER}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => onChoice("yes")}>
            {LOGIC_YES}
          </Button>
          <Button type="button" variant="outline" onClick={() => onChoice("tweak")}>
            {LOGIC_TWEAK}
          </Button>
        </div>
      </section>
    );
  }

  if (phase === "pass") {
    return <p className="text-sm text-rw-teal">{LOGIC_PASS}</p>;
  }

  if (phase === "moderate") {
    return (
      <section className="rounded-xl border border-rw-ink/15 bg-white p-4">
        <h3 className="font-display text-xl text-rw-ink">{LOGIC_MODERATE_TITLE}</h3>
        {reason ? <p className="mt-2 text-sm text-rw-ink/80">{reason}</p> : null}
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-medium">{LOGIC_WRITER}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => onChoice("keep")}>
            Keep my angle
          </Button>
          <Button type="button" variant="outline" onClick={() => onChoice("adjust")}>
            Adjust it
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border-2 border-red-700 bg-white p-4"
      role="region"
      aria-label={LOGIC_ALERT_LABEL}
    >
      <p className="text-sm font-semibold text-red-800">
        <span aria-hidden="true">⚠ </span>
        {LOGIC_ALERT_LABEL}
      </p>
      <h3 className="mt-2 font-display text-xl text-rw-ink">{LOGIC_STRONG_HEADLINE}</h3>
      <p className="mt-2 text-sm text-rw-ink/80">{LOGIC_STRONG_DETAIL}</p>
      {reason ? <p className="mt-2 text-sm text-rw-ink/80">{reason}</p> : null}
      {assignmentQuote ? (
        <p className="mt-2 text-sm text-rw-ink/80">Your assignment asks: “{assignmentQuote}”</p>
      ) : null}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onChoice("new_angle")}>
          Pick a new angle
        </Button>
        <Button type="button" variant="outline" onClick={() => onChoice("revise")}>
          Revise my claim
        </Button>
        <Button type="button" variant="outline" onClick={() => onChoice("reframe")}>
          Reframe it
        </Button>
        <Button
          type="button"
          onClick={() => {
            onChoice("continued");
            onContinue();
          }}
        >
          {LOGIC_CONTINUE}
        </Button>
      </div>
    </section>
  );
}
