import { describe, expect, it } from '@jest/globals';
import { TimerPhase } from '@/helpers/timer/strategy';
import { StopwatchStrategy } from './stopwatch-strategy';

describe('stopwatchStrategy', () => {
  const ROLLOVER_MS = 6_000_000;

  it('mirrors the elapsed time during the first 99 minutes', () => {
    const strategy = new StopwatchStrategy();

    const timeMs = 5_999_000;
    const state = strategy.calculateState({
      deltaMs: 1000,
      totalElapsedMs: timeMs,
    });

    expect(state.displayTimeMs).toBe(timeMs);
    expect(state.currentRound).toBe(1);
    expect(state.phase).toBe(TimerPhase.WORK);
    expect(state.isFinished).toBeFalsy();
  });

  it('rolls over the display time and increments round at exactly 100 minutes', () => {
    const strategy = new StopwatchStrategy();

    const state = strategy.calculateState({
      deltaMs: 1000,
      totalElapsedMs: ROLLOVER_MS,
    });

    expect(state.displayTimeMs).toBe(0);

    expect(state.currentRound).toBe(2);
    expect(state.isFinished).toBeFalsy();
  });

  it('calculates display time correctly after multiple rollovers', () => {
    const strategy = new StopwatchStrategy();

    // Simulate 250 minutes
    const timeMs = 15_000_000;
    const expectedDisplayTimeMs = 3_000_000;

    const state = strategy.calculateState({
      deltaMs: 1000,
      totalElapsedMs: timeMs,
    });

    expect(state.displayTimeMs).toBe(expectedDisplayTimeMs);
    expect(state.currentRound).toBe(3);
    expect(state.totalRounds).toBe(3);
    expect(state.isFinished).toBeFalsy();
  });
});
