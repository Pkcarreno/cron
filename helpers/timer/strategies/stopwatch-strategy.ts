import type { TickEvent } from '@/helpers/timer/tick-engine';
import type { TimerState, TimerStrategy } from '@/helpers/timer/strategy';
import { TimerPhase } from '@/helpers/timer/strategy';

export class StopwatchStrategy implements TimerStrategy {
  private readonly ROLLOVER_MS = 6_000_000;

  calculateState(event: TickEvent): TimerState {
    const currentRound =
      Math.floor(event.totalElapsedMs / this.ROLLOVER_MS) + 1;

    const displayTimeMs = event.totalElapsedMs % this.ROLLOVER_MS;

    return {
      currentRound,
      displayTimeMs,
      isFinished: false,
      phase: TimerPhase.WORK,
      totalRounds: currentRound,
    };
  }
}
