import { describe, expect, it } from "@jest/globals";

import { TimerPhase } from "@/helpers/timer/strategy";

import { StopwatchStrategy } from "./stopwatch-strategy";

describe("stopwatchStrategy", () => {
  it("mirrors the elapsed time infinitely without artificial rounds", () => {
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

  it("returns active PhaseDetails with elapsed time for background live notifications", () => {
    const strategy = new StopwatchStrategy();
    const phaseDetails = strategy.getPhaseDetails({
      deltaMs: 1000,
      totalElapsedMs: 42_000,
    });

    expect(phaseDetails).toEqual({
      currentRound: 1,
      isFinished: false,
      phase: TimerPhase.WORK,
      phaseDurationMs: 0,
      phaseRemainingMs: 42_000,
      totalRounds: 1,
    });
  });
});
