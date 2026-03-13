import { describe, expect, it } from '@jest/globals';
import { TimerPhase } from '@/helpers/timer/strategy';
import { StopwatchStrategy } from './stopwatch-strategy';

describe('stopwatchStrategy', () => {
  it('mirrors the elapsed time infinitely without artificial rounds', () => {
    const strategy = new StopwatchStrategy();

    const timeMs = 9_000_000;
    const state = strategy.calculateState({
      deltaMs: 1000,
      totalElapsedMs: timeMs,
    });

    expect(state.displayTimeMs).toBe(timeMs);
    expect(state.currentRound).toBe(1);
    expect(state.phase).toBe(TimerPhase.WORK);
    expect(state.isFinished).toBeFalsy();
  });
});
