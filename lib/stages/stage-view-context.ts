"use client";

// PC-30 QA #1/#4: whether this stage page is a read-only look back (a finished stage), so the
// chats inside can say so and leave out actions that can't be used there.
import { createContext, useContext } from "react";

export type StageViewInfo = { review: boolean; stage: number; paperStage: number };

export const StageViewContext = createContext<StageViewInfo>({ review: false, stage: 0, paperStage: 0 });

export function useStageView(): StageViewInfo {
  return useContext(StageViewContext);
}
