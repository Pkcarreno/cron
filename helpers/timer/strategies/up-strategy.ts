import type { TickEvent } from '@/helpers/timer/tick-engine';
import type { TimerState, TimerStrategy } from '@/helpers/timer/strategy';
import { TimerPhase } from '@/helpers/timer/strategy';

export class UpStrategy implements TimerStrategy {
  private targetTimeMs: number;

  constructor(targetTimeMs: number) {
    this.targetTimeMs = targetTimeMs;
  }

  calculateState(event: TickEvent): TimerState {
    const isFinished = event.totalElapsedMs >= this.targetTimeMs;

    return {
      currentRound: 1,
      displayTimeMs: isFinished ? this.targetTimeMs : event.totalElapsedMs,
      isFinished,
      phase: isFinished ? TimerPhase.DONE : TimerPhase.WORK,
      totalRounds: 1,
    };
  }
}
