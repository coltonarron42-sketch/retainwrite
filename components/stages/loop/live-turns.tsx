"use client";

import { PauPauGroup, StudentBubble } from "@/components/stages/stage1/chat-bubbles";
import type { LiveTurn } from "@/components/stages/loop/realtime-voice";
import { dsLink } from "@/lib/ds/classes";

/** Grok Voice turns from this call, shown as normal chat turns (not saved history). */
export function LiveTurns({ rows }: { rows: LiveTurn[] }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-4" data-rt-live>
      {rows
        .filter((r) => !r.saved && (r.text.trim() || r.sources?.length))
        .map((r) =>
          r.who === "you" ? (
            <StudentBubble key={r.id} message={{ text: r.text, files: [], at: 0 }} />
          ) : (
            <PauPauGroup
              key={r.id}
              bubbles={[
                r.text,
                ...(r.sources?.length
                  ? [
                      <ul key="src" className="space-y-2" data-rt-sources>
                        {r.sources.map((l) => (
                          <li key={l.url}>
                            <a href={l.url} target="_blank" rel="noopener noreferrer" className={dsLink}>
                              {l.title}
                            </a>
                            {l.why ? <span className="block text-[13px] text-ds-muted">{l.why}</span> : null}
                          </li>
                        ))}
                      </ul>,
                    ]
                  : []),
              ].filter(Boolean)}
            />
          ),
        )}
    </div>
  );
}
