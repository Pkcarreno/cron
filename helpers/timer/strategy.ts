import type { TickEvent } from "@/helpers/timer/tick-engine";

export enum TimerPhase {
  PREPARATION = "PREPARATION",
  WORK = "WORK",
  REST = "REST",
  DONE = "DONE",
}

export interface TimerState {
  displayTimeMs: number;
  currentRound: number;
  totalRounds: number;
  phase: TimerPhase;
  isFinished: boolean;
}

export interface PhaseDetails {
  currentRound: number;
  isFinished: boolean;
  phase: TimerPhase;
  phaseDurationMs: number;
  phaseRemainingMs: number;
  totalRounds: number;
}

export interface TimerStrategy {
  calculateState: (event: TickEvent) => TimerState;
  getTargetDurationMs?: () => number;
  getPhaseDetails?: (event: TickEvent) => PhaseDetails | null;
  getNextPhaseDetails?: (
    event: TickEvent
  ) => { phase: TimerPhase; durationMs: number } | null;
}
