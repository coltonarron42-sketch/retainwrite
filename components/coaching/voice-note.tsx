type Props = {
  note: string | null;
  preview?: boolean;
};

/** Bottom-of-results voice note. Hidden on previews and while the student is writing. */
export function VoiceNote({ note, preview = false }: Props) {
  if (preview || !note) return null;
  return (
    <p className="mt-8 border-t border-rw-ink/10 pt-4 text-sm text-rw-ink/70" data-voice-note="bottom">
      <span aria-hidden="true">ℹ︎ </span>
      {note}
    </p>
  );
}
