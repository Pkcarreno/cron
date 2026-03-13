import type { TickEvent } from '@/helpers/timer/tick-engine';
import type { TimerState, TimerStrategy } from '@/helpers/timer/strategy';
import { TimerPhase } from '@/helpers/timer/strategy';

export class StopwatchStrategy implements TimerStrategy {
  // oxlint-disable eslint/class-methods-use-this
  calculateState(event: TickEvent): TimerState {
    return {
      currentRound: 1,
      displayTimeMs: event.totalElapsedMs,
      isFinished: false,
      phase: TimerPhase.WORK,
      totalRounds: 1,
    };
  }
}
