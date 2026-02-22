import { describe, expect, it } from '@jest/globals';
import { IntervalStrategy } from '@/helpers/timer/strategies/interval-strategy';
import { TimerPhase } from '@/helpers/timer/strategy';
import type { TickEvent } from '@/helpers/timer/tick-engine';

describe('intervalStrategy', () => {
  const WORK_TIME_MS = 20_000;
  const REST_TIME_MS = 10_000;
  const TOTAL_PHASES = 3;

  it('sets phase to work and calculates countdown during first work phase', () => {
    const strategy = new IntervalStrategy(
      WORK_TIME_MS,
      REST_TIME_MS,
      TOTAL_PHASES
    );
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 5000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(15_000);
    expect(state.currentRound).toBe(1);
    expect(state.totalRounds).toBe(TOTAL_PHASES);
    expect(state.phase).toBe(TimerPhase.WORK);
    expect(state.isFinished).toBeFalsy();
  });

  it('sets phase to rest and increments round during first rest phase', () => {
    const strategy = new IntervalStrategy(
      WORK_TIME_MS,
      REST_TIME_MS,
      TOTAL_PHASES
    );
    const mockTickEvent: TickEvent = { deltaMs: 1000, totalElapsedMs: 25_000 };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(5000);
    expect(state.currentRound).toBe(1);
    expect(state.totalRounds).toBe(TOTAL_PHASES);
    expect(state.phase).toBe(TimerPhase.REST);
    expect(state.isFinished).toBeFalsy();
  });

  it('sets phase to work and increments round during second work phase', () => {
    const strategy = new IntervalStrategy(
      WORK_TIME_MS,
      REST_TIME_MS,
      TOTAL_PHASES
    );
    const mockTickEvent: TickEvent = {
      deltaMs: 1000,
      totalElapsedMs: 35_000,
    };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(15_000);
    expect(state.currentRound).toBe(2);
    expect(state.totalRounds).toBe(TOTAL_PHASES);
    expect(state.phase).toBe(TimerPhase.WORK);
    expect(state.isFinished).toBeFalsy();
  });

  it('returns finished state when total phases are completed ending on an odd round', () => {
    const strategy = new IntervalStrategy(
      WORK_TIME_MS,
      REST_TIME_MS,
      TOTAL_PHASES
    );
    const expectedTotalDurationMs =
      TOTAL_PHASES * (WORK_TIME_MS + REST_TIME_MS);
    const mockTickEvent: TickEvent = {
      deltaMs: 1000,
      totalElapsedMs: expectedTotalDurationMs,
    };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(0);
    expect(state.currentRound).toBe(TOTAL_PHASES);
    expect(state.totalRounds).toBe(TOTAL_PHASES);
    expect(state.phase).toBe(TimerPhase.DONE);
    expect(state.isFinished).toBeTruthy();
  });

  it('returns finished state when total phases are completed ending on an even round', () => {
    const evenTotalPhases = 4;
    const strategy = new IntervalStrategy(
      WORK_TIME_MS,
      REST_TIME_MS,
      evenTotalPhases
    );
    const expectedTotalDurationMs =
      evenTotalPhases * (WORK_TIME_MS + REST_TIME_MS);
    const mockTickEvent: TickEvent = {
      deltaMs: 1000,
      totalElapsedMs: expectedTotalDurationMs,
    };

    const state = strategy.calculateState(mockTickEvent);

    expect(state.displayTimeMs).toBe(0);
    expect(state.currentRound).toBe(evenTotalPhases);
    expect(state.totalRounds).toBe(evenTotalPhases);
    expect(state.phase).toBe(TimerPhase.DONE);
    expect(state.isFinished).toBeTruthy();
  });
});
