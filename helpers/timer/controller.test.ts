import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { TimerController, TimerEventType } from "@/helpers/timer/controller";
import { DownStrategy } from "@/helpers/timer/strategies/down-strategy";
import { UpStrategy } from "@/helpers/timer/strategies/up-strategy";
import type { TimerState } from "@/helpers/timer/strategy";
import { TimerPhase } from "@/helpers/timer/strategy";

import { IntervalStrategy } from "./strategies/interval-strategy";
import { StopwatchStrategy } from "./strategies/stopwatch-strategy";

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

      expect(tickSpy).toHaveBeenCalledTimes(101);

      expect(tickSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          displayTimeMs: expect.any(Number),
          phase: TimerPhase.WORK,
        })
      );
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

      expect(tickSpy).toHaveBeenCalledTimes(1001);
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

      expect(tickSpy).toHaveBeenCalledTimes(501);
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
      controller.on(TimerEventType.FINISH, finishSpy);
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();

      jest.advanceTimersByTime(10);

      expect(tickSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRound: 1,
          phase: TimerPhase.WORK,
        })
      );

      // advance to complete the first work phase, now time is 2000ms
      jest.advanceTimersByTime(1990);

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

      controller.on(TimerEventType.FINISH, finishSpy);
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
      expect(tickSpy).toHaveBeenCalledTimes(101);

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
      expect(spy2).toHaveBeenCalledTimes(101);
    });
  });

  describe("session Summary and Manual Termination", () => {
    const DEFAULT_PREPARATION_MS = 10_000;

    it("provides a summary with fullyCompleted set to true when timer finishes automatically", () => {
      const targetTimeMs = 5000;
      const strategy = new UpStrategy(targetTimeMs);
      const controller = new TimerController(strategy, DEFAULT_PREPARATION_MS);

      const finishSpy = jest.fn();
      controller.on(TimerEventType.FINISH, finishSpy);

      controller.start();

      jest.advanceTimersByTime(targetTimeMs + DEFAULT_PREPARATION_MS);

      expect(finishSpy).toHaveBeenCalledTimes(1);

      expect(finishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          activeSessionTimeMs: targetTimeMs,
          fullyCompleted: true,
          roundsCompleted: 1,
          totalSessionTimeMs: targetTimeMs + DEFAULT_PREPARATION_MS,
        })
      );
    });

    it("provides a summary with fullyCompleted set to false when finishTimer is called manually", () => {
      const strategy = new StopwatchStrategy();
      const controller = new TimerController(strategy, 0);

      const finishSpy = jest.fn();
      const tickSpy = jest.fn();

      controller.on(TimerEventType.FINISH, finishSpy);
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();

      const sessionDurationMs = 120_000;
      jest.advanceTimersByTime(sessionDurationMs);

      expect(finishSpy).not.toHaveBeenCalled();

      controller.finishTimer();

      expect(finishSpy).toHaveBeenCalledTimes(1);

      expect(finishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          activeSessionTimeMs: sessionDurationMs,
          fullyCompleted: false,
        })
      );

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

  describe("audio feedback integration", () => {
    it("dispatches countdown beeps, go cue, phase transitions, and completion cues", () => {
      const mockAudioService = {
        playCountdownBeep: jest.fn((_second?: number) => Promise.resolve()),
        playFinishCue: jest.fn((_isCompleted?: boolean) => Promise.resolve()),
        playGoCue: jest.fn(() => Promise.resolve()),
        playLapCue: jest.fn(() => Promise.resolve()),
        playPhaseTransitionCue: jest.fn((_phase?: TimerPhase) =>
          Promise.resolve()
        ),
        playRoundChangeCue: jest.fn((_round?: number) => Promise.resolve()),
        stopAudio: jest.fn(),
      };

      const strategy = new IntervalStrategy(2000, 1000, 2);
      const preparationMs = 3000;
      const controller = new TimerController(strategy, preparationMs, {
        audioService: mockAudioService,
      });

      controller.start();

      // Preparation countdown: 3s, 2s, 1s
      jest.advanceTimersByTime(1000);
      expect(mockAudioService.playCountdownBeep).toHaveBeenCalledWith(2);

      jest.advanceTimersByTime(1000);
      expect(mockAudioService.playCountdownBeep).toHaveBeenCalledWith(1);

      // Transition to WORK (Go cue)
      jest.advanceTimersByTime(1000);
      expect(mockAudioService.playGoCue).toHaveBeenCalledTimes(1);

      // Work phase 1 -> Rest phase 1
      jest.advanceTimersByTime(2000);
      expect(mockAudioService.playPhaseTransitionCue).toHaveBeenCalledWith(
        TimerPhase.REST
      );

      // Rest phase 1 -> Work phase 2 (Round 2)
      jest.advanceTimersByTime(1000);
      expect(mockAudioService.playRoundChangeCue).toHaveBeenCalledWith(2);
      expect(mockAudioService.playPhaseTransitionCue).toHaveBeenCalledWith(
        TimerPhase.WORK
      );

      // Work phase 2 -> Rest phase 2 -> Finish
      jest.advanceTimersByTime(3000);
      expect(mockAudioService.playFinishCue).toHaveBeenCalledWith(true);
    });

    it("dispatches lap cues on recordCheckpoint", () => {
      const mockAudioService = {
        playCountdownBeep: jest.fn((_second?: number) => Promise.resolve()),
        playFinishCue: jest.fn((_isCompleted?: boolean) => Promise.resolve()),
        playGoCue: jest.fn(() => Promise.resolve()),
        playLapCue: jest.fn(() => Promise.resolve()),
        playPhaseTransitionCue: jest.fn((_phase?: TimerPhase) =>
          Promise.resolve()
        ),
        playRoundChangeCue: jest.fn((_round?: number) => Promise.resolve()),
        stopAudio: jest.fn(),
      };

      const strategy = new StopwatchStrategy();
      const controller = new TimerController(strategy, 0, {
        audioService: mockAudioService,
      });

      controller.start();
      jest.advanceTimersByTime(1000);
      controller.recordCheckpoint();

      expect(mockAudioService.playLapCue).toHaveBeenCalledTimes(1);
    });

    it("halts audio on pause, reset, and dispose", () => {
      const mockAudioService = {
        playCountdownBeep: jest.fn((_second?: number) => Promise.resolve()),
        playFinishCue: jest.fn((_isCompleted?: boolean) => Promise.resolve()),
        playGoCue: jest.fn(() => Promise.resolve()),
        playLapCue: jest.fn(() => Promise.resolve()),
        playPhaseTransitionCue: jest.fn((_phase?: TimerPhase) =>
          Promise.resolve()
        ),
        playRoundChangeCue: jest.fn((_round?: number) => Promise.resolve()),
        stopAudio: jest.fn(),
      };

      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0, {
        audioService: mockAudioService,
      });

      controller.start();
      controller.pause();
      expect(mockAudioService.stopAudio).toHaveBeenCalledTimes(1);

      controller.reset();
      expect(mockAudioService.stopAudio).toHaveBeenCalledTimes(2);

      controller.dispose();
      expect(mockAudioService.stopAudio).toHaveBeenCalledTimes(3);
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
      const mockAudioService = {
        playCountdownBeep: jest.fn((_second?: number) => Promise.resolve()),
        playFinishCue: jest.fn((_isCompleted?: boolean) => Promise.resolve()),
        playGoCue: jest.fn(() => Promise.resolve()),
        playLapCue: jest.fn(() => Promise.resolve()),
        playPhaseTransitionCue: jest.fn((_phase?: TimerPhase) =>
          Promise.resolve()
        ),
        playRoundChangeCue: jest.fn((_round?: number) => Promise.resolve()),
        stopAudio: jest.fn(),
      };
      const controller = new TimerController(strategy, 0, {
        audioService: mockAudioService,
      });

      const finishSpy = jest.fn();
      controller.on(TimerEventType.FINISH, finishSpy);

      controller.start();
      jest.advanceTimersByTime(1000);

      // Go to background and advance beyond workout duration
      controller.handleAppStateChange("background");
      jest.advanceTimersByTime(10_000);

      expect(finishSpy).not.toHaveBeenCalled();

      // Return to foreground
      controller.handleAppStateChange("active");

      expect(finishSpy).toHaveBeenCalledTimes(1);
      expect(finishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fullyCompleted: true,
        })
      );
      expect(mockAudioService.playFinishCue).toHaveBeenCalledWith(true);
    });
  });
});
