"use client";

import { Button } from "@/components/ui/button";
import {
  KNOW_THIS_ONE,
  SOMETHING_ELSE,
  TEACH_FOOTER,
  type TeachCard,
} from "@/lib/coaching/teach";

type Props = {
  card: TeachCard;
  onAspect: (aspect: string) => void;
  onSkipKnown: () => void;
};

export function TeachCardView({ card, onAspect, onSkipKnown }: Props) {
  return (
    <section className="rounded-xl border border-rw-ink/15 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
        Quick lesson: {card.concept}
      </p>
      {card.affirm ? <p className="mt-2 text-sm text-rw-ink">{card.affirm}</p> : null}
      <p className="mt-3 text-sm text-rw-ink/80">{card.definition}</p>
      <p className="mt-4 text-sm font-medium text-rw-ink">{card.ask}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {card.qualities.map((quality) => (
          <Button key={quality} type="button" size="sm" variant="outline" onClick={() => onAspect(quality)}>
            {quality}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => onAspect(SOMETHING_ELSE)}>
          {SOMETHING_ELSE}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onSkipKnown}>
          {KNOW_THIS_ONE}
        </Button>
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-rw-ink/70">
        {card.showsUpAs.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-rw-ink/75">{TEACH_FOOTER}</p>
    </section>
  );
}
