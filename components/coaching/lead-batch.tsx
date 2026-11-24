"use client";

import { Button } from "@/components/ui/button";
import type { PreparedLead } from "@/lib/coaching/leadBatch";

type Props = {
  ranked: PreparedLead[];
  wildcard: PreparedLead | null;
  capReached: boolean;
  searchPrompt: string | null;
  onPick: (lead: PreparedLead) => void;
};

export function LeadBatchView({ ranked, wildcard, capReached, searchPrompt, onPick }: Props) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {ranked.map((lead) => (
          <li key={lead.name} className="rounded-xl border border-rw-ink/15 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-rw-ink">
                {lead.rank === 1 ? <span className="mr-2 text-xs uppercase text-rw-teal">Best fit</span> : null}
                {lead.name}
              </p>
              {" "}<span className="text-xs font-semibold uppercase text-rw-ink/75">Check it yourself</span>
            </div>
            <p className="mt-1 text-sm text-rw-ink/70">{lead.whyFits}</p>
            <Button type="button" size="sm" className="mt-3" variant="outline" onClick={() => onPick(lead)}>
              Try this direction
            </Button>
          </li>
        ))}
      </ul>
      {wildcard ? (
        <div className="rounded-xl border border-dashed border-rw-ink/25 bg-rw-paper p-4">
          <p className="text-sm text-rw-ink/70">
            The ones above are usually cited. Here&apos;s one outside the box that shows the same pattern.
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-rw-ink/75">Outside the box</p>
          <p className="mt-1 font-medium text-rw-ink">{wildcard.name}</p>
          <p className="mt-1 text-sm text-rw-ink/75">{wildcard.wildcardWhy}</p>
          {wildcard.controversyNote ? (
            <p className="mt-1 text-sm text-rw-ink/75">{wildcard.controversyNote}</p>
          ) : null}
          <p className="mt-2 text-xs text-rw-ink/75">
            A stretch pick. The ones above are the safer fit for your rubric.
          </p>
          <Button type="button" size="sm" className="mt-3" variant="outline" onClick={() => onPick(wildcard)}>
            Try this stretch
          </Button>
        </div>
      ) : null}
      {capReached && searchPrompt ? (
        <div className="rounded-xl bg-white p-4 text-sm">
          <p className="font-medium text-rw-ink">Search it yourself</p>
          <p className="mt-2 text-rw-ink/75">{searchPrompt}</p>
        </div>
      ) : null}
    </div>
  );
}
