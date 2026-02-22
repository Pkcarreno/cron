import { describe, expect, it } from '@jest/globals';
import { DownStrategy } from '@/helpers/timer/strategies/down-strategy';
import { TimerPhase } from '@/helpers/timer/strategy';
import type { TickEvent } from '@/helpers/timer/tick-engine';

describe('downStrategy', () => {
  const TARGET_TIME_MS = 60_000;

  it('calculates remaining time correctly before reaching zero', () => {
    const strategy = new DownStrategy(TARGET_TIME_MS);
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 15_000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(45_000);
    expect(state.currentRound).toBe(1);
    expect(state.totalRounds).toBe(1);
    expect(state.phase).toBe(TimerPhase.WORK);
    expect(state.isFinished).toBeFalsy();
  });

  it('returns finished state and caps display time at zero when target time is reached', () => {
    const strategy = new DownStrategy(TARGET_TIME_MS);
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 60_000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(0);
    expect(state.phase).toBe(TimerPhase.DONE);
    expect(state.isFinished).toBeTruthy();
  });

  it('prevents negative display time when elapsed time exceeds target time', () => {
    const strategy = new DownStrategy(TARGET_TIME_MS);
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 65_000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(0);
    expect(state.phase).toBe(TimerPhase.DONE);
    expect(state.isFinished).toBeTruthy();
  });
});
