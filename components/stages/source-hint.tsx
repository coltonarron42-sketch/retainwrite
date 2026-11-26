"use client";

import { dsCaption, dsLink } from "@/lib/ds/classes";
import { sourceHintLead, type SourceHint } from "@/lib/coaching/source-hints";

/**
 * P3: at a section's first prompt, the stored source that belongs there, with when and where to use it.
 * A reference card inside Pau's turn (not a second question); the points are the source's, labelled.
 */
export function SourceHintCard({ stage, sectionTitle, hints }: { stage: 2 | 3; sectionTitle: string; hints: SourceHint[] }) {
  if (!hints.length) return null;
  return (
    <div className="space-y-2 border-t border-ds-border pt-3 text-[16px] leading-[1.6]" data-source-hint data-chat-part>
      <p>{sourceHintLead(stage, sectionTitle)}</p>
      {hints.map((h) => (
        <div key={h.title} className="space-y-1" data-source-hint-item>
          <p className="font-semibold">
            {h.url ? (
              <a className={dsLink} href={h.url} target="_blank" rel="noopener noreferrer">
                {h.title}
              </a>
            ) : (
              h.title
            )}
            <span className={`${dsCaption} font-normal`}> · from {h.from}</span>
          </p>
          {h.points.length ? (
            <ul className="list-disc space-y-1 pl-5 text-ds-muted">
              {h.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
