import { act, cleanup } from "@testing-library/react-native";
import { createStore } from "jotai";

import type { SessionSummary } from "@/helpers/timer/controller";
import type { TimerConfig } from "@/helpers/timer/factory";
import { TimerMode } from "@/helpers/timer/factory";
import { TimerPhase } from "@/helpers/timer/strategy";
import { preparationTimeMsAtom } from "@/stores/settings";
import { renderHookWithProviders } from "@/test-utils/render-with-providers";

import type { UICheckpoint } from "./use-timer";
import { TimerStatus, useTimer } from "./use-timer";

describe("useTimer integration", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("timer state progression and lifecycle", () => {
    it("initializes with READY status and default state", async () => {
      const store = createStore();
      store.set(preparationTimeMsAtom, 5000);

      const config: TimerConfig = {
        durationMs: 60_000,
        mode: TimerMode.AMRAP,
      };

      const { result } = await renderHookWithProviders(() => useTimer(config), {
        store,
      });

      expect(result.current.status).toBe(TimerStatus.READY);
      expect(result.current.phase).toBe(TimerPhase.PREPARATION);
      expect(result.current.flags.isPreparing).toBe(true);
      expect(result.current.flags.showsMinuteDigits).toBe(false);
      expect(result.current.modeAbbr).toBe("AMR");
    });

    it("progresses through preparation into active workout, and pauses/resumes", async () => {
      const store = createStore();
      store.set(preparationTimeMsAtom, 3000);

      const config: TimerConfig = {
        durationMs: 30_000,
        mode: TimerMode.AMRAP,
      };

      const { result } = await renderHookWithProviders(() => useTimer(config), {
        store,
      });

      await act(() => {
        result.current.start();
      });

      expect(result.current.status).toBe(TimerStatus.RUNNING);

      // Advance through 3 seconds of preparation
      await act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.phase).toBe(TimerPhase.WORK);
      expect(result.current.flags.isPreparing).toBe(false);
      expect(result.current.flags.showsMinuteDigits).toBe(true);

      // Advance 5 seconds of active workout
      await act(() => {
        jest.advanceTimersByTime(5000);
      });
      const displayTimeAtPause = result.current.displayTimeMs;

      // Pause the timer
      await act(() => {
        result.current.pause();
      });
      expect(result.current.status).toBe(TimerStatus.PAUSED);

      // Advance 2 seconds while paused: display time should not change
      await act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current.displayTimeMs).toBe(displayTimeAtPause);

      // Resume timer
      await act(() => {
        result.current.start();
      });
      expect(result.current.status).toBe(TimerStatus.RUNNING);

      await act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(result.current.displayTimeMs).not.toBe(displayTimeAtPause);

      // Reset timer
      await act(() => {
        result.current.reset();
      });
      expect(result.current.status).toBe(TimerStatus.READY);
    });
  });

  describe("event callback dispatching", () => {
    it("dispatches onBeep, onGo, and onFinish callbacks", async () => {
      const store = createStore();
      store.set(preparationTimeMsAtom, 3000);

      const onBeep = jest.fn();
      const onGo = jest.fn();
      const onPhaseChange = jest.fn();
      const onRoundChange = jest.fn();
      const onFinish = jest.fn();

      const config: TimerConfig = {
        durationMs: 5000,
        mode: TimerMode.AMRAP,
      };

      const { result } = await renderHookWithProviders(
        () =>
          useTimer(config, {
            onBeep,
            onFinish,
            onGo,
            onPhaseChange,
            onRoundChange,
          }),
        { store }
      );

      await act(() => {
        result.current.start();
      });

      // Advance through preparation (3s)
      await act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(onBeep).toHaveBeenCalled();
      expect(onGo).toHaveBeenCalledTimes(1);

      // Advance through workout duration (5s) to finish
      await act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe(TimerStatus.FINISHED);

      const summary: SessionSummary = onFinish.mock.calls[0][0];
      expect(summary.totalSessionTimeMs).toBeGreaterThan(0);
      expect(summary.fullyCompleted).toBe(true);
    });

    it("dispatches onRoundChange and onPhaseChange in interval mode", async () => {
      const store = createStore();
      store.set(preparationTimeMsAtom, 0);

      const onPhaseChange = jest.fn();
      const onRoundChange = jest.fn();

      const config: TimerConfig = {
        mode: TimerMode.INTERVAL,
        restMs: 5000,
        totalRounds: 2,
        workMs: 10_000,
      };

      const { result } = await renderHookWithProviders(
        () =>
          useTimer(config, {
            onPhaseChange,
            onRoundChange,
          }),
        { store }
      );

      await act(() => {
        result.current.start();
      });

      // Advance through work phase of round 1 (10s)
      await act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(onPhaseChange).toHaveBeenCalledWith(TimerPhase.REST);

      // Advance through rest phase into round 2 (5s)
      await act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(onRoundChange).toHaveBeenCalledWith(2);
      expect(onPhaseChange).toHaveBeenCalledWith(TimerPhase.WORK);
    });
  });

  describe("checkpoint calculations", () => {
    it("records checkpoints with split/lap calculations in stopwatch mode", async () => {
      const store = createStore();
      store.set(preparationTimeMsAtom, 0);

      const onCheckpoint = jest.fn();

      const config: TimerConfig = {
        mode: TimerMode.STOP_WATCH,
      };

      const { result } = await renderHookWithProviders(
        () =>
          useTimer(config, {
            onCheckpoint,
          }),
        { store }
      );

      await act(() => {
        result.current.start();
      });

      // Advance 100ms so tick moves phase from PREPARATION to WORK
      await act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.flags.hasCheckpointsBehavior).toBe(true);

      // Advance 4 seconds and record checkpoint 1
      await act(() => {
        jest.advanceTimersByTime(4000);
      });

      await act(() => {
        result.current.recordCheckpoint();
      });

      expect(onCheckpoint).toHaveBeenCalledTimes(1);
      const cp1: UICheckpoint = onCheckpoint.mock.calls[0][0];
      expect(cp1.lap).toBe(1);
      expect(cp1.elapsedTimeMs).toBeGreaterThanOrEqual(4000);
      expect(cp1.lapDurationMs).toBeGreaterThanOrEqual(4000);
      expect(cp1.lapDeltaMs).toBe(0);
      expect(cp1.recordedAt).toBeInstanceOf(Date);

      // Advance another 3 seconds and record checkpoint 2
      await act(() => {
        jest.advanceTimersByTime(3000);
      });

      await act(() => {
        result.current.recordCheckpoint();
      });

      expect(onCheckpoint).toHaveBeenCalledTimes(2);
      const cp2: UICheckpoint = onCheckpoint.mock.calls[1][0];
      expect(cp2.lap).toBe(2);
      expect(cp2.elapsedTimeMs).toBeGreaterThan(cp1.elapsedTimeMs);
      expect(cp2.lapDurationMs).toBeGreaterThanOrEqual(3000);

      // Check summary
      const summary = result.current.getSummary();
      expect(summary).toBeDefined();
      expect(summary?.checkpoints).toHaveLength(2);
      expect(summary?.startedAt).toBeInstanceOf(Date);
    });

    it("ends session via handleEndSession cleanly", async () => {
      const store = createStore();
      store.set(preparationTimeMsAtom, 0);

      const config: TimerConfig = {
        mode: TimerMode.STOP_WATCH,
      };

      const { result } = await renderHookWithProviders(() => useTimer(config), {
        store,
      });

      await act(() => {
        result.current.start();
      });

      await act(() => {
        jest.advanceTimersByTime(2000);
      });

      await act(() => {
        result.current.handleEndSession();
      });

      expect(result.current.status).toBe(TimerStatus.FINISHED);
    });
  });
});
