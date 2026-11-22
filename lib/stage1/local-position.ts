/**
 * Where the student is in Stage 1, written to this device the moment Next is
 * pressed. The server copy lands a beat later (the save runs in the
 * background), so a quick reload must prefer whichever position is newer.
 */
export type LocalPosition = {
  questionId: string | null;
  at: number;
  answered?: {
    questionId: string;
    questionText: string;
    kind: string;
    answerText: string;
    isVoiceSample: boolean;
    pasteRatio?: number;
  };
};

const key = (paperId: string) => `rw:pos:${paperId}`;

export function saveLocalPosition(paperId: string, pos: LocalPosition) {
  try {
    window.localStorage.setItem(key(paperId), JSON.stringify(pos));
  } catch {
    /* private mode */
  }
}

export function readLocalPosition(paperId: string): LocalPosition | null {
  try {
    const raw = window.localStorage.getItem(key(paperId));
    if (!raw) return null;
    const pos = JSON.parse(raw) as LocalPosition;
    return typeof pos?.at === "number" ? pos : null;
  } catch {
    return null;
  }
}

/** The device position wins when it is newer than the server's (same device clock). */
export function preferLocalPosition(local: LocalPosition | null, serverAt: number | null | undefined): boolean {
  if (!local) return false;
  return local.at > (serverAt ?? 0);
}
