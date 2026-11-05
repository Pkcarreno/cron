import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import type { LiveActivityDriver } from "@/helpers/background/live-activity-driver";
import { TimerController, TimerEventType } from "@/helpers/timer/controller";
import { TimerMode } from "@/helpers/timer/factory";
import { DownStrategy } from "@/helpers/timer/strategies/down-strategy";
import { UpStrategy } from "@/helpers/timer/strategies/up-strategy";
import type { TimerState } from "@/helpers/timer/strategy";
import { TimerPhase } from "@/helpers/timer/strategy";

import { IntervalStrategy } from "./strategies/interval-strategy";
import { StopwatchStrategy } from "./strategies/stopwatch-strategy";

const createMockDriver = (): jest.Mocked<LiveActivityDriver> => ({
  attachController: jest.fn((_controller) => jest.fn()),
  pause: jest.fn((_elapsedDisplayTime) => Promise.resolve()),
  resume: jest.fn((_session) => Promise.resolve()),
  start: jest.fn((_session) => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  update: jest.fn((_session) => Promise.resolve()),
});

// oxlint-disable eslint/max-lines
describe("timerController", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 1, 1, 0, 0, 0));
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe("initialization and basic flow", () => {
    it("emits start event when started", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      const startSpy = jest.fn();
      controller.on(TimerEventType.START, startSpy);

      controller.start();

      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    it("emits tick events with the current state", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      const tickSpy = jest.fn();
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();
      jest.advanceTimersByTime(100);

      expect(tickSpy).toHaveBeenCalledTimes(2);

      expect(tickSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          displayTimeMs: expect.any(Number),
          phase: TimerPhase.WORK,
        })
      );
    });

    it("emits tick events at high precision rate when enabled", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0, {
        highPrecision: true,
      });

      const tickSpy = jest.fn();
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();
      jest.advanceTimersByTime(100);

      expect(tickSpy).toHaveBeenCalledTimes(101);
    });

    it("emits tick events continuously while quantizing UI_TICK to visible seconds", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      const tickSpy = jest.fn();
      const uiTickSpy = jest.fn();
      controller.on(TimerEventType.TICK, tickSpy);
      controller.on(TimerEventType.UI_TICK, uiTickSpy);

      controller.start();
      jest.advanceTimersByTime(1000);

      expect(tickSpy).toHaveBeenCalledTimes(20);
      expect(uiTickSpy.mock.calls.length).toBeLessThanOrEqual(2);
      expect(uiTickSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: TimerPhase.WORK,
        })
      );
    });

    it("emits UI_TICK strictly on visible second changes (1 Hz) in AMRAP mode", () => {
      const strategy = new DownStrategy(5000);
      const controller = new TimerController(strategy, 0);

      const uiTickSpy = jest.fn();
      controller.on(TimerEventType.UI_TICK, uiTickSpy);

      controller.start();
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);

      expect(uiTickSpy).toHaveBeenCalledTimes(6);
    });

    it("supports configurable sub-second resolution for STOP_WATCH mode", () => {
      const strategy = new StopwatchStrategy();
      const controller = new TimerController(strategy, 0, {
        uiTickResolutionMs: 100,
      });

      expect(controller.getUiTickResolution()).toBe(100);

      const tickSpy = jest.fn();
      const uiTickSpy = jest.fn();
      controller.on(TimerEventType.TICK, tickSpy);
      controller.on(TimerEventType.UI_TICK, uiTickSpy);

      controller.start();
      jest.advanceTimersByTime(500);

      expect(tickSpy).toHaveBeenCalledTimes(10);
      expect(uiTickSpy).toHaveBeenCalledTimes(6);

      controller.setUiTickResolution(200);
      expect(controller.getUiTickResolution()).toBe(200);
    });
  });

  describe("preparation phase, beeps and go", () => {
    it("emits beeps only during the last 3 seconds of preparation", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 5000);

      const beepSpy = jest.fn();
      const goSpy = jest.fn();

      controller.on(TimerEventType.BEEP, beepSpy);
      controller.on(TimerEventType.GO, goSpy);

      controller.start();

      jest.advanceTimersByTime(1000);
      // 4 sec remaining
      expect(beepSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      // 3 sec remaining
      expect(beepSpy).toHaveBeenCalledWith(3);

      jest.advanceTimersByTime(1000);
      // 2 sec remaining
      expect(beepSpy).toHaveBeenCalledWith(2);

      jest.advanceTimersByTime(1000);
      // 1 sec remaining
      expect(beepSpy).toHaveBeenCalledWith(1);

      // advance past preparation into work phase
      jest.advanceTimersByTime(2000);

      expect(beepSpy).toHaveBeenCalledTimes(3);
      expect(goSpy).toHaveBeenCalledTimes(1);
    });

    it("does not emit beeps during the work phase even in the last 3 seconds", () => {
      const strategy = new UpStrategy(5000);
      const controller = new TimerController(strategy, 0);

      const beepSpy = jest.fn();
      controller.on(TimerEventType.BEEP, beepSpy);

      controller.start();

      jest.advanceTimersByTime(5000);

      expect(beepSpy).not.toHaveBeenCalled();
    });
  });

  describe("lifecycle", () => {
    it("walks through a complete interval strategy emitting the correct sequences", () => {
      const workTimeMs = 2000;
      const restTimeMs = 1000;
      const totalPhases = 3;

      const strategy = new IntervalStrategy(
        workTimeMs,
        restTimeMs,
        totalPhases
      );

      const controller = new TimerController(strategy, 0);

      const phaseChangeSpy = jest.fn();
      const roundChangeSpy = jest.fn();
      const finishSpy = jest.fn();
      const tickSpy = jest.fn();

      controller.on(TimerEventType.PHASE_CHANGE, phaseChangeSpy);
      controller.on(TimerEventType.ROUND_CHANGE, roundChangeSpy);
      controller.on(TimerEventType.COMPLETED, finishSpy);
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();

      jest.advanceTimersByTime(50);

      expect(tickSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRound: 1,
          phase: TimerPhase.WORK,
        })
      );

      // advance to complete the first work phase, now time is 2000ms
      jest.advanceTimersByTime(1950);

      expect(tickSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRound: 1,
          phase: TimerPhase.REST,
        })
      );
      expect(phaseChangeSpy).toHaveBeenCalledTimes(1);
      expect(roundChangeSpy).not.toHaveBeenCalled();

      // advance to complete the first rest phase, now time is 3000ms
      jest.advanceTimersByTime(1000);

      expect(tickSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRound: 2,
          phase: TimerPhase.WORK,
        })
      );
      expect(phaseChangeSpy).toHaveBeenCalledTimes(2);
      expect(roundChangeSpy).toHaveBeenCalledWith(2);

      // advance to complete the last rest phase, now time is 9000ms
      jest.advanceTimersByTime(6000);

      expect(tickSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRound: 3,
          isFinished: true,
          phase: TimerPhase.DONE,
        })
      );
      expect(phaseChangeSpy).toHaveBeenCalledTimes(5);
      expect(roundChangeSpy).toHaveBeenCalledWith(3);

      expect(finishSpy).toHaveBeenCalledTimes(1);
    });

    it("emits finish event and stops processing other events when time is up", () => {
      const testDurationMs = 5000;
      const strategy = new UpStrategy(testDurationMs);
      const controller = new TimerController(strategy, 0);

      const finishSpy = jest.fn();
      const phaseChangeSpy = jest.fn();

      controller.on(TimerEventType.COMPLETED, finishSpy);
      controller.on(TimerEventType.PHASE_CHANGE, phaseChangeSpy);

      controller.start();

      // advance to te end of the timer
      jest.advanceTimersByTime(testDurationMs);

      expect(finishSpy).toHaveBeenCalledTimes(1);

      expect(phaseChangeSpy).not.toHaveBeenCalledWith(TimerPhase.DONE);
    });
  });

  describe("engine Controls", () => {
    it("pauses the underlying engine and stops emitting ticks", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      const tickSpy = jest.fn();

      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();
      jest.advanceTimersByTime(100);

      const ticksBeforePause = tickSpy.mock.calls.length;

      controller.pause();

      //advance whilie in pause
      jest.advanceTimersByTime(500);

      const ticksAfterPause = tickSpy.mock.calls.length;

      expect(ticksAfterPause).toBe(ticksBeforePause);

      // keep advancing after pause
      controller.start();
      jest.advanceTimersByTime(500);

      const ticksAfterRestart = tickSpy.mock.calls.length;

      expect(ticksAfterRestart).not.toBe(ticksAfterPause);
    });
  });

  describe("resource Management & Cleanup", () => {
    it("removes all listeners preventing zombie callbacks", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      const tickSpy = jest.fn();
      const startSpy = jest.fn();

      controller.on(TimerEventType.TICK, tickSpy);
      controller.on(TimerEventType.START, startSpy);

      controller.removeAllListeners();

      controller.start();
      jest.advanceTimersByTime(100);

      expect(startSpy).not.toHaveBeenCalled();
      expect(tickSpy).not.toHaveBeenCalled();
    });

    it("dispose() stops the engine AND clears listeners simultaneously", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      const tickSpy = jest.fn();
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();
      jest.advanceTimersByTime(100);
      expect(tickSpy).toHaveBeenCalledTimes(2);

      const callsBeforeDispose = tickSpy.mock.calls.length;

      controller.dispose();

      jest.advanceTimersByTime(5000);

      const callsAfterDispose = tickSpy.mock.calls.length;

      expect(callsAfterDispose).toBe(callsBeforeDispose);
    });

    it("allows re-subscribing after cleaning listeners", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);
      const spy1 = jest.fn();
      const spy2 = jest.fn();

      controller.on(TimerEventType.TICK, spy1);
      controller.removeAllListeners();

      controller.on(TimerEventType.TICK, spy2);

      controller.start();
      jest.advanceTimersByTime(100);

      expect(spy1).not.toHaveBeenCalled();
      expect(spy2).toHaveBeenCalledTimes(2);
    });
  });

  describe("session Summary and Manual Termination", () => {
    const DEFAULT_PREPARATION_MS = 10_000;

    it("provides a summary with fullyCompleted set to true when timer finishes automatically", () => {
      const targetTimeMs = 5000;
      const strategy = new UpStrategy(targetTimeMs);
      const controller = new TimerController(strategy, DEFAULT_PREPARATION_MS);

      const completedSpy = jest.fn();
      controller.on(TimerEventType.COMPLETED, completedSpy);

      controller.start();

      jest.advanceTimersByTime(targetTimeMs + DEFAULT_PREPARATION_MS);

      expect(completedSpy).toHaveBeenCalledTimes(1);

      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          activeSessionTimeMs: targetTimeMs,
          fullyCompleted: true,
          roundsCompleted: 1,
          totalSessionTimeMs: targetTimeMs + DEFAULT_PREPARATION_MS,
        })
      );
    });

    it("clamps activeSessionTimeMs and totalSessionTimeMs to exact target duration when finished automatically with tick overshoot", () => {
      const targetTimeMs = 60_020;
      const strategy = new DownStrategy(targetTimeMs);
      const controller = new TimerController(strategy, DEFAULT_PREPARATION_MS);

      const completedSpy = jest.fn();
      controller.on(TimerEventType.COMPLETED, completedSpy);

      controller.start();

      // Advancing to 80,000ms ensures the tick engine crosses the 70,020ms boundary
      // Because interval is 50ms, the finishing tick fires at 70,050ms (30ms overshoot)
      jest.advanceTimersByTime(80_000);

      expect(completedSpy).toHaveBeenCalledTimes(1);
      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          activeSessionTimeMs: targetTimeMs,
          fullyCompleted: true,
          totalSessionTimeMs: targetTimeMs + DEFAULT_PREPARATION_MS,
        })
      );
    });

    it("does not emit COMPLETED event when paused and disposed manually", () => {
      const strategy = new StopwatchStrategy();
      const controller = new TimerController(strategy, 0);

      const completedSpy = jest.fn();
      const tickSpy = jest.fn();

      controller.on(TimerEventType.COMPLETED, completedSpy);
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();

      const sessionDurationMs = 120_000;
      jest.advanceTimersByTime(sessionDurationMs);

      expect(completedSpy).not.toHaveBeenCalled();

      controller.pause();
      controller.dispose();

      expect(completedSpy).not.toHaveBeenCalled();

      const ticksBeforeAdvancing = tickSpy.mock.calls.length;
      jest.advanceTimersByTime(5000);
      const ticksAfterAdvancing = tickSpy.mock.calls.length;

      expect(ticksAfterAdvancing).toBe(ticksBeforeAdvancing);
    });

    it("returns the current session statistics without pausing or destroying the engine", () => {
      const sessionTargetMs = 10_000;
      const preparationMs = 3000;
      const strategy = new UpStrategy(sessionTargetMs);
      const controller = new TimerController(strategy, preparationMs);

      const tickSpy = jest.fn();
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();

      jest.advanceTimersByTime(5000);

      const currentSummary = controller.getSummary();

      expect(currentSummary.totalSessionTimeMs).toBe(5000);
      expect(currentSummary.activeSessionTimeMs).toBe(2000);
      expect(currentSummary.roundsCompleted).toBe(1);
      expect(currentSummary.fullyCompleted).toBeFalsy();

      const ticksAtSnapshot = tickSpy.mock.calls.length;

      jest.advanceTimersByTime(1000);

      const ticksAfterSnapshot = tickSpy.mock.calls.length;

      expect(ticksAfterSnapshot).toBeGreaterThan(ticksAtSnapshot);
    });
  });

  describe("checkpoints", () => {
    it("records a single checkpoint and emits the event with correct initial split", () => {
      const targetTimeMs = 10_000;
      const strategy = new UpStrategy(targetTimeMs);
      const controller = new TimerController(strategy, 0);

      const checkpointSpy = jest.fn();
      controller.on(TimerEventType.CHECKPOINT, checkpointSpy);

      controller.start();
      jest.advanceTimersByTime(2500);

      controller.recordCheckpoint();

      expect(checkpointSpy).toHaveBeenCalledTimes(1);

      expect(checkpointSpy).toHaveBeenNthCalledWith(1, {
        elapsedTimeMs: 2500,
        lap: 1,
        lapDeltaMs: 0,
        lapDurationMs: 2500,
      });
    });

    it("calculates split times correctly across multiple consecutive checkpoints", () => {
      const strategy = new StopwatchStrategy();
      const controller = new TimerController(strategy, 0);

      const checkpointSpy = jest.fn();
      controller.on(TimerEventType.CHECKPOINT, checkpointSpy);

      controller.start();

      jest.advanceTimersByTime(2000);
      controller.recordCheckpoint();

      jest.advanceTimersByTime(3500);
      controller.recordCheckpoint();

      jest.advanceTimersByTime(1000);
      controller.recordCheckpoint();

      expect(checkpointSpy).toHaveBeenCalledTimes(3);

      expect(checkpointSpy).toHaveBeenNthCalledWith(1, {
        elapsedTimeMs: 2000,
        lap: 1,
        lapDeltaMs: 0,
        lapDurationMs: 2000,
      });

      expect(checkpointSpy).toHaveBeenNthCalledWith(2, {
        elapsedTimeMs: 5500,
        lap: 2,
        lapDeltaMs: 1500,
        lapDurationMs: 3500,
      });

      expect(checkpointSpy).toHaveBeenNthCalledWith(3, {
        elapsedTimeMs: 6500,
        lap: 3,
        lapDeltaMs: -2500,
        lapDurationMs: 1000,
      });
    });

    it("excludes preparation time from the recorded active time", () => {
      const targetTimeMs = 10_000;
      const preparationMs = 3000;
      const strategy = new UpStrategy(targetTimeMs);
      const controller = new TimerController(strategy, preparationMs);

      const checkpointSpy = jest.fn();
      controller.on(TimerEventType.CHECKPOINT, checkpointSpy);

      controller.start();

      jest.advanceTimersByTime(3000);
      jest.advanceTimersByTime(4000);

      controller.recordCheckpoint();

      expect(checkpointSpy).toHaveBeenNthCalledWith(1, {
        elapsedTimeMs: 4000,
        lap: 1,
        lapDeltaMs: 0,
        lapDurationMs: 4000,
      });
    });

    it("includes the complete checkpoint history in the generated session summary", () => {
      const strategy = new StopwatchStrategy();
      const controller = new TimerController(strategy, 0);

      controller.start();

      jest.advanceTimersByTime(1000);
      controller.recordCheckpoint();

      jest.advanceTimersByTime(2000);
      controller.recordCheckpoint();

      const summary = controller.getSummary();

      expect(summary.checkpoints).toBeDefined();
    });
  });

  describe("pure lifecycle event emission (decoupled from audio)", () => {
    it("emits countdown beeps, go, phase transitions, and completion events", () => {
      const onBeep = jest.fn();
      const onGo = jest.fn();
      const onPhaseChange = jest.fn();
      const onRoundChange = jest.fn();
      const onFinish = jest.fn();

      const strategy = new IntervalStrategy(2000, 1000, 2);
      const preparationMs = 3000;
      const controller = new TimerController(strategy, preparationMs);

      controller.on(TimerEventType.BEEP, onBeep);
      controller.on(TimerEventType.GO, onGo);
      controller.on(TimerEventType.PHASE_CHANGE, onPhaseChange);
      controller.on(TimerEventType.ROUND_CHANGE, onRoundChange);
      controller.on(TimerEventType.COMPLETED, onFinish);

      controller.start();

      // Preparation countdown: 3s, 2s, 1s
      jest.advanceTimersByTime(1000);
      expect(onBeep).toHaveBeenCalledWith(2);

      jest.advanceTimersByTime(1000);
      expect(onBeep).toHaveBeenCalledWith(1);

      // Transition to WORK (Go)
      jest.advanceTimersByTime(1000);
      expect(onGo).toHaveBeenCalledTimes(1);

      // Work phase 1 -> Rest phase 1
      jest.advanceTimersByTime(2000);
      expect(onPhaseChange).toHaveBeenCalledWith(TimerPhase.REST);

      // Rest phase 1 -> Work phase 2 (Round 2)
      jest.advanceTimersByTime(1000);
      expect(onRoundChange).toHaveBeenCalledWith(2);
      expect(onPhaseChange).toHaveBeenCalledWith(TimerPhase.WORK);

      // Work phase 2 -> Rest phase 2 -> Finish
      jest.advanceTimersByTime(3000);
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({ fullyCompleted: true })
      );
    });

    it("emits checkpoint events on recordCheckpoint without audio dependency", () => {
      const onCheckpoint = jest.fn();
      const strategy = new StopwatchStrategy();
      const controller = new TimerController(strategy, 0);

      controller.on(TimerEventType.CHECKPOINT, onCheckpoint);

      controller.start();
      jest.advanceTimersByTime(1000);
      controller.recordCheckpoint();

      expect(onCheckpoint).toHaveBeenCalledTimes(1);
      expect(onCheckpoint).toHaveBeenCalledWith(
        expect.objectContaining({ lap: 1 })
      );
    });

    it("emits pause and reset lifecycle events purely", () => {
      const onPause = jest.fn();
      const onReset = jest.fn();
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      controller.on(TimerEventType.PAUSE, onPause);
      controller.on(TimerEventType.RESET, onReset);

      controller.start();
      controller.pause();
      expect(onPause).toHaveBeenCalledTimes(1);

      controller.reset();
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it("emits TRANSITION_APPROACHING lookahead event 500ms before countdown and phase transitions", () => {
      const onApproachingTransition = jest.fn();
      const onBeep = jest.fn();
      const onGo = jest.fn();
      const onPhaseChange = jest.fn();

      const strategy = new IntervalStrategy(2000, 1000, 1);
      const preparationMs = 5000;
      const controller = new TimerController(strategy, preparationMs);

      controller.on(
        TimerEventType.TRANSITION_APPROACHING,
        onApproachingTransition
      );
      controller.on(TimerEventType.BEEP, onBeep);
      controller.on(TimerEventType.GO, onGo);
      controller.on(TimerEventType.PHASE_CHANGE, onPhaseChange);

      controller.start();

      // At 1400ms: no transition approaching yet (3600ms remaining prep)
      jest.advanceTimersByTime(1400);
      expect(onApproachingTransition).not.toHaveBeenCalled();

      // At 1500ms: 500ms lookahead sees 3000ms remaining prep -> emits TRANSITION_APPROACHING
      jest.advanceTimersByTime(100);
      expect(onApproachingTransition).toHaveBeenCalledTimes(1);

      // At 2000ms: Countdown beep (3) emits
      jest.advanceTimersByTime(500);
      expect(onBeep).toHaveBeenCalledWith(3);

      // Advance to 4500ms (500ms before GO)
      jest.advanceTimersByTime(2500);
      expect(onApproachingTransition).toHaveBeenCalledTimes(2);

      // At 5000ms: GO emits
      jest.advanceTimersByTime(500);
      expect(onGo).toHaveBeenCalledTimes(1);

      // In WORK phase (2000ms): at 1500ms into work (6500ms total), 500ms lookahead sees REST phase transition
      jest.advanceTimersByTime(1500);
      expect(onApproachingTransition).toHaveBeenCalledTimes(3);

      // At 7000ms: REST phase emits
      jest.advanceTimersByTime(500);
      expect(onPhaseChange).toHaveBeenCalledWith(TimerPhase.REST);
    });

    it("emits TRANSITION_APPROACHING immediately on start when preparation is short (<= 3000ms)", () => {
      const onApproachingTransition = jest.fn();
      const strategy = new UpStrategy(10_000);
      // 2s preparation
      const preparationMs = 2000;
      const controller = new TimerController(strategy, preparationMs);

      controller.on(
        TimerEventType.TRANSITION_APPROACHING,
        onApproachingTransition
      );

      controller.start();
      jest.advanceTimersByTime(50);

      // Immediately anticipates countdown beep at 2s remaining
      expect(onApproachingTransition).toHaveBeenCalledTimes(1);
    });

    it("fires TRANSITION_APPROACHING and countdown beeps accurately at 20 Hz without dropped cues", () => {
      const onApproachingTransition = jest.fn();
      const onBeep = jest.fn();
      const onGo = jest.fn();

      const strategy = new UpStrategy(10_000);
      const preparationMs = 4000;
      const controller = new TimerController(strategy, preparationMs);

      controller.on(
        TimerEventType.TRANSITION_APPROACHING,
        onApproachingTransition
      );
      controller.on(TimerEventType.BEEP, onBeep);
      controller.on(TimerEventType.GO, onGo);

      controller.start();

      // At 500ms: remaining 3500ms, future 3000ms -> TRANSITION_APPROACHING fires
      jest.advanceTimersByTime(500);
      expect(onApproachingTransition).toHaveBeenCalledTimes(1);

      // At 1000ms: beep(3)
      jest.advanceTimersByTime(500);
      expect(onBeep).toHaveBeenCalledWith(3);

      // At 2000ms: beep(2)
      jest.advanceTimersByTime(1000);
      expect(onBeep).toHaveBeenCalledWith(2);

      // At 3000ms: beep(1)
      jest.advanceTimersByTime(1000);
      expect(onBeep).toHaveBeenCalledWith(1);

      // At 3500ms: 500ms before GO -> TRANSITION_APPROACHING fires
      jest.advanceTimersByTime(500);
      expect(onApproachingTransition).toHaveBeenCalledTimes(2);

      // At 4000ms: GO fires
      jest.advanceTimersByTime(500);
      expect(onGo).toHaveBeenCalledTimes(1);
      expect(onBeep).toHaveBeenCalledTimes(3);
    });
  });

  describe("AppState lifecycle and background catch-up", () => {
    it("pauses visual updates while in background and suppresses UI_TICK", () => {
      const strategy = new DownStrategy(30_000);
      const controller = new TimerController(strategy, 0);

      const uiTickSpy = jest.fn();
      controller.on(TimerEventType.UI_TICK, uiTickSpy);

      controller.start();
      jest.advanceTimersByTime(1000);
      expect(uiTickSpy).toHaveBeenCalled();
      const callsBeforeBg = uiTickSpy.mock.calls.length;

      // Transition to background
      controller.handleAppStateChange("background");
      expect(controller.getIsVisualUpdatesPaused()).toBe(true);

      // Advance time while in background: visual updates are paused
      jest.advanceTimersByTime(5000);
      expect(uiTickSpy.mock.calls.length).toBe(callsBeforeBg);
    });

    it("calculates wall-clock delta and runs state catch-up on returning to foreground", () => {
      const strategy = new DownStrategy(30_000);
      const controller = new TimerController(strategy, 0);

      const uiTickSpy = jest.fn();
      controller.on(TimerEventType.UI_TICK, uiTickSpy);

      controller.start();
      jest.advanceTimersByTime(2000);
      expect(controller.getSummary().totalSessionTimeMs).toBe(2000);

      // Enter background for 10 seconds
      controller.handleAppStateChange("background");
      jest.advanceTimersByTime(10_000);

      // Return to active foreground
      controller.handleAppStateChange("active");
      expect(controller.getIsVisualUpdatesPaused()).toBe(false);

      // Verify state caught up to 12s total elapsed (18s remaining in 30s countdown)
      const lastCall = uiTickSpy.mock.calls.at(-1)?.[0] as TimerState;
      expect(lastCall.displayTimeMs).toBe(18_000);
      expect(controller.getSummary().totalSessionTimeMs).toBe(12_000);
    });

    it("triggers completion when workout finishes while in background", () => {
      const strategy = new DownStrategy(5000);
      const controller = new TimerController(strategy, 0);

      const finishSpy = jest.fn();
      controller.on(TimerEventType.COMPLETED, finishSpy);

      controller.start();
      jest.advanceTimersByTime(1000);

      // Go to background and advance beyond workout duration
      controller.handleAppStateChange("background");
      jest.advanceTimersByTime(10_000);

      // Completed milestone fires on schedule in background
      expect(finishSpy).toHaveBeenCalledTimes(1);
      expect(finishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fullyCompleted: true,
        })
      );

      // Return to foreground maintains completed state without duplicate emission
      controller.handleAppStateChange("active");
      expect(finishSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("deterministic milestone scheduling and background audio cues (#117)", () => {
    it("pauses high-cadence rendering loops without halting timer progression when backgrounded", () => {
      const strategy = new IntervalStrategy(10_000, 5000, 2);
      const controller = new TimerController(strategy, 5000);

      const uiTickSpy = jest.fn();
      const goSpy = jest.fn();
      controller.on(TimerEventType.UI_TICK, uiTickSpy);
      controller.on(TimerEventType.GO, goSpy);

      controller.start();
      jest.advanceTimersByTime(500);
      expect(uiTickSpy).toHaveBeenCalled();
      const uiTicksBeforeBg = uiTickSpy.mock.calls.length;

      // App transitions to background
      controller.handleAppStateChange("background");
      expect(controller.getIsVisualUpdatesPaused()).toBe(true);

      // Milestone scheduler holds the background timers
      expect(controller.getScheduledMilestones()).not.toBeNull();

      // Advance through remainder of preparation (4500ms)
      jest.advanceTimersByTime(4500);

      // High-cadence UI rendering ticks are suppressed
      expect(uiTickSpy.mock.calls.length).toBe(uiTicksBeforeBg);

      // But GO transition fires on schedule
      expect(goSpy).toHaveBeenCalledTimes(1);
    });

    it("pre-warms audio DAC ~1500 ms before countdown beeps trigger to prevent cold-start clipping", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 5000);

      const warmupSpy = jest.fn();
      const beepSpy = jest.fn();
      const goSpy = jest.fn();

      controller.on(TimerEventType.TRANSITION_APPROACHING, warmupSpy);
      controller.on(TimerEventType.BEEP, beepSpy);
      controller.on(TimerEventType.GO, goSpy);

      controller.start();
      controller.handleAppStateChange("background");

      // In 5000ms prep with countdown beeps at 2000ms (3s left), 3000ms, 4000ms:
      // Audio DAC prewarm triggers at 500ms (5000 - 4500 = 500ms, exactly 1500ms before beep 3)
      jest.advanceTimersByTime(500);
      expect(warmupSpy).toHaveBeenCalledTimes(1);
      expect(beepSpy).not.toHaveBeenCalled();

      // At 2000ms: beep(3) fires (exactly 1500ms after warmup)
      jest.advanceTimersByTime(1500);
      expect(beepSpy).toHaveBeenCalledWith(3);

      // At 3000ms: beep(2) fires
      jest.advanceTimersByTime(1000);
      expect(beepSpy).toHaveBeenCalledWith(2);

      // At 4000ms: beep(1) fires
      jest.advanceTimersByTime(1000);
      expect(beepSpy).toHaveBeenCalledWith(1);

      // At 5000ms: GO fires
      jest.advanceTimersByTime(1000);
      expect(goSpy).toHaveBeenCalledTimes(1);
    });

    it("transitions interval phases accurately on schedule without countdown beeps during work/rest while backgrounded", () => {
      // 0ms prep, 5000ms work, 4000ms rest, 1 round
      const strategy = new IntervalStrategy(5000, 4000, 1);
      const controller = new TimerController(strategy, 0);

      const beepSpy = jest.fn();
      const phaseChangeSpy = jest.fn();
      const finishSpy = jest.fn();

      controller.on(TimerEventType.BEEP, beepSpy);
      controller.on(TimerEventType.PHASE_CHANGE, phaseChangeSpy);
      controller.on(TimerEventType.COMPLETED, finishSpy);

      controller.start();
      controller.handleAppStateChange("background");

      // Work phase (5000ms): no countdown beeps during work
      jest.advanceTimersByTime(4500);
      expect(beepSpy).not.toHaveBeenCalled();

      // At 5000ms: Transition to REST
      jest.advanceTimersByTime(500);
      expect(phaseChangeSpy).toHaveBeenCalledWith(TimerPhase.REST);
      expect(beepSpy).not.toHaveBeenCalled();

      // Rest phase (4000ms): no countdown beeps during rest
      jest.advanceTimersByTime(3500);
      expect(beepSpy).not.toHaveBeenCalled();

      // At 9000ms: Workout completes
      jest.advanceTimersByTime(500);
      expect(finishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fullyCompleted: true,
        })
      );
      expect(beepSpy).not.toHaveBeenCalled();
    });

    it("clears milestone timers on pause and reschedules with remaining duration on resume in background", () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 5000);

      const warmupSpy = jest.fn();
      const beepSpy = jest.fn();
      const goSpy = jest.fn();

      controller.on(TimerEventType.TRANSITION_APPROACHING, warmupSpy);
      controller.on(TimerEventType.BEEP, beepSpy);
      controller.on(TimerEventType.GO, goSpy);

      controller.start();
      controller.handleAppStateChange("background");

      // Advance 300ms into 5s prep (4700ms remaining, warmup is at 500ms so it hasn't fired yet)
      jest.advanceTimersByTime(300);

      // Pause while in background
      controller.pause();
      expect(controller.getScheduledMilestones()).toBeNull();

      // Advance while paused: no events fire
      jest.advanceTimersByTime(30_000);
      expect(warmupSpy).not.toHaveBeenCalled();
      expect(beepSpy).not.toHaveBeenCalled();
      expect(goSpy).not.toHaveBeenCalled();

      // Resume while still in background: reschedules for remaining 4700ms
      controller.start();
      expect(controller.getScheduledMilestones()).not.toBeNull();

      // Warmup at 4700 - 4500 = 200ms from resume
      jest.advanceTimersByTime(200);
      expect(warmupSpy).toHaveBeenCalledTimes(1);

      // Countdown beep 3 at 4700 - 3000 = 1700ms from resume (+1500ms)
      jest.advanceTimersByTime(1500);
      expect(beepSpy).toHaveBeenCalledWith(3);
    });

    it("reconciles elapsed time to exact millisecond and resumes UI rendering on foreground return", () => {
      const strategy = new DownStrategy(30_000);
      const controller = new TimerController(strategy, 0);

      const uiTickSpy = jest.fn();
      controller.on(TimerEventType.UI_TICK, uiTickSpy);

      controller.start();
      controller.handleAppStateChange("background");

      // Advance by arbitrary non-integer seconds in background
      jest.advanceTimersByTime(12_345);

      // Return to foreground
      controller.handleAppStateChange("active");
      expect(controller.getIsVisualUpdatesPaused()).toBe(false);
      expect(controller.getScheduledMilestones()).toBeNull();

      // UI tick reconciled to exact millisecond
      const lastState = uiTickSpy.mock.calls.at(-1)?.[0] as TimerState;
      expect(lastState.displayTimeMs).toBe(17_655);
      expect(controller.getSummary().totalSessionTimeMs).toBe(12_345);
    });
  });

  describe("LiveActivityDriver integration", () => {
    it("starts driver with active session payload when controller starts", () => {
      const strategy = new IntervalStrategy(30_000, 15_000, 4);
      strategy.mode = TimerMode.INTERVAL;
      const mockDriver = createMockDriver();

      const controller = new TimerController(strategy, 5000, {
        liveActivityDriver: mockDriver,
        mode: TimerMode.INTERVAL,
      });

      controller.start();

      expect(mockDriver.start).toHaveBeenCalledTimes(1);
      expect(mockDriver.start).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRound: 0,
          isPaused: false,
          mode: TimerMode.INTERVAL,
          nextPhase: TimerPhase.WORK,
          nextPhaseDurationMs: 30_000,
          phase: TimerPhase.PREPARATION,
          phaseDurationMs: 5000,
          totalRounds: 0,
        })
      );
    });

    it("starts driver with count-up isCountDown false for STOP_WATCH mode", () => {
      const strategy = new StopwatchStrategy();
      const mockDriver = createMockDriver();

      const controller = new TimerController(strategy, 0, {
        liveActivityDriver: mockDriver,
        mode: TimerMode.STOP_WATCH,
      });

      controller.start();

      expect(mockDriver.start).toHaveBeenCalledTimes(1);
      expect(mockDriver.start).toHaveBeenCalledWith(
        expect.objectContaining({
          isCountDown: false,
          isPaused: false,
          mode: TimerMode.STOP_WATCH,
          phase: TimerPhase.WORK,
        })
      );
    });

    it("pauses driver with formatted display string when paused", () => {
      const strategy = new DownStrategy(60_000);
      strategy.mode = TimerMode.AMRAP;
      const mockDriver = createMockDriver();

      const controller = new TimerController(strategy, 0, {
        liveActivityDriver: mockDriver,
        mode: TimerMode.AMRAP,
      });

      controller.start();
      jest.advanceTimersByTime(12_000);
      controller.pause();

      expect(mockDriver.pause).toHaveBeenCalledTimes(1);
      expect(mockDriver.pause).toHaveBeenCalledWith("00:48");
    });

    it("resumes driver after pause when restarted", () => {
      const strategy = new DownStrategy(60_000);
      strategy.mode = TimerMode.AMRAP;
      const mockDriver = createMockDriver();

      const controller = new TimerController(strategy, 0, {
        liveActivityDriver: mockDriver,
        mode: TimerMode.AMRAP,
      });

      controller.start();
      controller.pause();
      controller.start();

      expect(mockDriver.resume).toHaveBeenCalledTimes(1);
      expect(mockDriver.resume).toHaveBeenCalledWith(
        expect.objectContaining({
          isPaused: false,
          mode: TimerMode.AMRAP,
        })
      );
    });

    it("stops driver cleanly when timer resets or disposes", () => {
      const strategy = new UpStrategy(60_000);
      const mockDriver = createMockDriver();

      const controller = new TimerController(strategy, 0, {
        liveActivityDriver: mockDriver,
        mode: TimerMode.FOR_TIME,
      });

      controller.start();
      controller.reset();
      expect(mockDriver.stop).toHaveBeenCalledTimes(1);

      controller.dispose();
      expect(mockDriver.stop).toHaveBeenCalledTimes(2);
    });

    it("stops driver when workout completes", () => {
      const strategy = new DownStrategy(1000);
      const mockDriver = createMockDriver();

      const controller = new TimerController(strategy, 0, {
        liveActivityDriver: mockDriver,
        mode: TimerMode.AMRAP,
      });

      controller.start();
      jest.advanceTimersByTime(1050);

      expect(mockDriver.stop).toHaveBeenCalledTimes(1);
    });

    it("dispatches driver update on phase transitions", () => {
      const strategy = new IntervalStrategy(2000, 1000, 2);
      strategy.mode = TimerMode.INTERVAL;
      const mockDriver = createMockDriver();

      const controller = new TimerController(strategy, 1000, {
        liveActivityDriver: mockDriver,
        mode: TimerMode.INTERVAL,
      });

      controller.start();

      // Transition from PREP to WORK at 1000ms
      jest.advanceTimersByTime(1000);

      expect(mockDriver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRound: 1,
          nextPhase: TimerPhase.REST,
          nextPhaseDurationMs: 1000,
          phase: TimerPhase.WORK,
        })
      );
    });

    it("dispatches driver update on background transition", () => {
      const strategy = new IntervalStrategy(2000, 1000, 2);
      strategy.mode = TimerMode.INTERVAL;
      const mockDriver = createMockDriver();

      const controller = new TimerController(strategy, 0, {
        liveActivityDriver: mockDriver,
        mode: TimerMode.INTERVAL,
      });

      controller.start();
      controller.handleAppStateChange("background");

      // Advance by 2000ms (end of WORK phase in background)
      jest.advanceTimersByTime(2000);

      expect(mockDriver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRound: 1,
          nextPhase: TimerPhase.WORK,
          nextPhaseDurationMs: 2000,
          phase: TimerPhase.REST,
        })
      );
    });

    it("dispatches driver update on checkpoint in AMRAP and Stopwatch", () => {
      const strategy = new DownStrategy(60_000);
      strategy.mode = TimerMode.AMRAP;
      const mockDriver = createMockDriver();

      const controller = new TimerController(strategy, 0, {
        liveActivityDriver: mockDriver,
        mode: TimerMode.AMRAP,
      });

      controller.start();
      controller.recordCheckpoint();

      expect(mockDriver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRound: 2,
          mode: TimerMode.AMRAP,
        })
      );
    });

    it("computes accurate next phase details during preparation and active phases", () => {
      const strategy = new IntervalStrategy(45_000, 15_000, 5);
      strategy.mode = TimerMode.INTERVAL;

      const controller = new TimerController(strategy, 10_000, {
        mode: TimerMode.INTERVAL,
      });

      // During preparation (elapsed < 10_000)
      const nextDuringPrep = controller.getNextPhaseDetails(3000);
      expect(nextDuringPrep).toEqual({
        durationMs: 45_000,
        phase: TimerPhase.WORK,
      });

      // During active work phase (elapsed = 20_000 total, which is 10_000 into work)
      const nextDuringWork = controller.getNextPhaseDetails(20_000);
      expect(nextDuringWork).toEqual({
        durationMs: 15_000,
        phase: TimerPhase.REST,
      });

      // During active rest phase (elapsed = 10_000 prep + 45_000 work + 5_000 rest = 60_000)
      const nextDuringRest = controller.getNextPhaseDetails(60_000);
      expect(nextDuringRest).toEqual({
        durationMs: 45_000,
        phase: TimerPhase.WORK,
      });
    });
  });
});
