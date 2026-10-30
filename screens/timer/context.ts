import { createContext, useContext } from "react";

import type { UISessionSummary } from "@/hooks/use-timer";

export interface TimerActions {
  pause: () => void;
  start: () => void;
  reset: () => void;
  recordCheckpoint: () => void;
  handleEndSession: () => void;
  getSummary: () => UISessionSummary | undefined;
}

export const TimerContext = createContext<TimerActions | null>(null);

export const useTimerContext = (): TimerActions => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimerContext must be used within a <Timer.Root>");
  }
  return context;
};
