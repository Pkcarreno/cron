import type { TickEvent } from '@/helpers/timer/tick-engine';

export enum TimerPhase {
  PREPARATION = 'PREPARATION',
  WORK = 'WORK',
  REST = 'REST',
  DONE = 'DONE',
}

export interface TimerState {
  displayTimeMs: number;
  currentRound: number;
  totalRounds: number;
  phase: TimerPhase;
  isFinished: boolean;
}

export interface TimerStrategy {
  calculateState(event: TickEvent): TimerState;
}
