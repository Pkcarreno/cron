import { describe, expect, it } from '@jest/globals';
import { UpStrategy } from '@/helpers/timer/strategies/up-strategy';
import { TimerPhase } from '@/helpers/timer/strategy';
import type { TickEvent } from '@/helpers/timer/tick-engine';

describe('upStrategy', () => {
  const TARGET_TIME_MS = 60_000;

  it('calculates progressing state correctly before reaching target time', () => {
    const strategy = new UpStrategy(TARGET_TIME_MS);
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 15_000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(15_000);
    expect(state.currentRound).toBe(1);
    expect(state.totalRounds).toBe(1);
    expect(state.phase).toBe(TimerPhase.WORK);
    expect(state.isFinished).toBeFalsy();
  });

  it('returns finished state and caps display time when exact target time is reached', () => {
    const strategy = new UpStrategy(TARGET_TIME_MS);
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 60_000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(TARGET_TIME_MS);
    expect(state.phase).toBe(TimerPhase.DONE);
    expect(state.isFinished).toBeTruthy();
  });

  it('returns finished state and caps display time when target time is exceeded', () => {
    const strategy = new UpStrategy(TARGET_TIME_MS);
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 65_000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(TARGET_TIME_MS);
    expect(state.phase).toBe(TimerPhase.DONE);
    expect(state.isFinished).toBeTruthy();
  });
});
