import type { TickEvent } from '@/helpers/timer/tick-engine';
import type { TimerState, TimerStrategy } from '@/helpers/timer/strategy';
import { TimerPhase } from '@/helpers/timer/strategy';

export class IntervalStrategy implements TimerStrategy {
  private cycleTimeMs: number;

  constructor(
    private workTimeMs: number,
    private restTimeMs: number,
    private totalRounds: number
  ) {
    this.cycleTimeMs = this.workTimeMs + this.restTimeMs;
  }

  calculateState(event: TickEvent): TimerState {
    const isFinished =
      event.totalElapsedMs >= this.cycleTimeMs * this.totalRounds;

    if (isFinished) {
      return {
        currentRound: this.totalRounds,
        displayTimeMs: 0,
        isFinished: true,
        phase: TimerPhase.DONE,
        totalRounds: this.totalRounds,
      };
    }

    const currentRound =
      Math.floor(event.totalElapsedMs / this.cycleTimeMs) + 1;
    const timeInCycle = event.totalElapsedMs % this.cycleTimeMs;
    const isWorkPhase = timeInCycle < this.workTimeMs;

    return {
      currentRound,
      displayTimeMs: isWorkPhase
        ? this.workTimeMs - timeInCycle
        : this.cycleTimeMs - timeInCycle,
      isFinished: false,
      phase: isWorkPhase ? TimerPhase.WORK : TimerPhase.REST,
      totalRounds: this.totalRounds,
    };
  }
}
