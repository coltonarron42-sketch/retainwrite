export type CorpusSegment = {
  fileId?: string;
  fileName?: string;
  page?: number;
  text: string;
  method?: string;
  quality?: number;
};

/**
 * Build the ordered assignment corpus string MODEL_STRONG / fallback parse read.
 */
export function mergeCorpus(segments: CorpusSegment[]): string {
  return segments
    .map((s) => {
      const label = [
        s.fileName ? `file:${s.fileName}` : null,
        s.fileId ? `id:${s.fileId}` : null,
        s.page != null ? `page:${s.page}` : null,
        s.method ? `method:${s.method}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      const body = s.text.trim();
      if (!body) return "";
      return label ? `[${label}]\n${body}` : body;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function usableWordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
