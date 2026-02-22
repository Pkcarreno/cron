import type { TickEvent } from '@/helpers/timer/tick-engine';
import type { TimerState, TimerStrategy } from '@/helpers/timer/strategy';
import { TimerPhase } from '@/helpers/timer/strategy';

export class RoundStrategy implements TimerStrategy {
  private roundTimeMs: number;
  private totalRounds: number;

  constructor(roundTimeMs: number, totalRounds: number) {
    this.roundTimeMs = roundTimeMs;
    this.totalRounds = totalRounds;
  }

  calculateState(event: TickEvent): TimerState {
    const totalDuration = this.roundTimeMs * this.totalRounds;
    const isFinished = event.totalElapsedMs >= totalDuration;

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
      Math.floor(event.totalElapsedMs / this.roundTimeMs) + 1;
    const timeInCurrentRound = event.totalElapsedMs % this.roundTimeMs;
    const displayTimeMs = this.roundTimeMs - timeInCurrentRound;

    return {
      currentRound,
      displayTimeMs,
      isFinished: false,
      phase: TimerPhase.WORK,
      totalRounds: this.totalRounds,
    };
  }
}
