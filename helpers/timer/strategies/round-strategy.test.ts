import { describe, expect, it } from '@jest/globals';
import { RoundStrategy } from '@/helpers/timer/strategies/round-strategy';
import { TimerPhase } from '@/helpers/timer/strategy';
import type { TickEvent } from '@/helpers/timer/tick-engine';

describe('roundStrategy', () => {
  const ROUND_DURATION_MS = 60_000;
  const TOTAL_ROUNDS = 3;

  it('calculates remaining time and sets round one correctly during first round', () => {
    const strategy = new RoundStrategy(ROUND_DURATION_MS, TOTAL_ROUNDS);
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 15_000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(45_000);
    expect(state.currentRound).toBe(1);
    expect(state.totalRounds).toBe(TOTAL_ROUNDS);
    expect(state.phase).toBe(TimerPhase.WORK);
    expect(state.isFinished).toBeFalsy();
  });

  it('increments round and reset countdown when entering second round', () => {
    const strategy = new RoundStrategy(ROUND_DURATION_MS, TOTAL_ROUNDS);
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 70_000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(50_000);
    expect(state.currentRound).toBe(2);
    expect(state.totalRounds).toBe(TOTAL_ROUNDS);
    expect(state.phase).toBe(TimerPhase.WORK);
    expect(state.isFinished).toBeFalsy();
  });

  it('returns finished state when all rounds are completed', () => {
    const strategy = new RoundStrategy(ROUND_DURATION_MS, TOTAL_ROUNDS);
    const totalDurationMs = ROUND_DURATION_MS * TOTAL_ROUNDS;
    const mockTickEvent: TickEvent = {
      deltaMs: 1000,
      totalElapsedMs: totalDurationMs,
    };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(0);
    expect(state.currentRound).toBe(TOTAL_ROUNDS);
    expect(state.totalRounds).toBe(TOTAL_ROUNDS);
    expect(state.phase).toBe(TimerPhase.DONE);
    expect(state.isFinished).toBeTruthy();
  });
});
