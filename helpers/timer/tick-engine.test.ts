import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { TickEngine } from "@/helpers/timer/tick-engine";

describe("tickEngine", () => {
  let engine: TickEngine;
  let mockTickCallback: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date(2026, 1, 1, 0, 0, 0));

    engine = new TickEngine();
    mockTickCallback = jest.fn();
    engine.onTickCallbacks.push(mockTickCallback);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("standard 20 Hz Mode (default)", () => {
    it("defaults to standard 20 Hz mode (isHighPrecision === false)", () => {
      expect(engine.getIsHighPrecision()).toBe(false);
    });

    it("does not emit ticks before starting", () => {
      jest.advanceTimersByTime(100);
      expect(mockTickCallback).not.toHaveBeenCalled();
    });

    it("emits tick events at 50 ms (20 Hz) intervals with correct delta and total elapsed time", () => {
      engine.start();

      jest.advanceTimersByTime(50);

      expect(mockTickCallback).toHaveBeenCalledTimes(1);
      expect(mockTickCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          deltaMs: 50,
          totalElapsedMs: 50,
        })
      );

      jest.advanceTimersByTime(100);

      expect(mockTickCallback).toHaveBeenCalledTimes(3);
      expect(mockTickCallback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          deltaMs: 50,
          totalElapsedMs: 150,
        })
      );
    });

    it("stops emitting ticks after pause is called", () => {
      engine.start();
      jest.advanceTimersByTime(100);

      const callsBeforePause = mockTickCallback.mock.calls.length;

      engine.pause();
      jest.advanceTimersByTime(100);

      const callsAfterPause = mockTickCallback.mock.calls.length;

      expect(callsAfterPause).toBe(callsBeforePause);
    });

    it("resumes total elapsed time correctly after being paused", () => {
      engine.start();
      jest.advanceTimersByTime(100);
      engine.pause();

      jest.advanceTimersByTime(500);

      engine.start();
      jest.advanceTimersByTime(50);

      expect(mockTickCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalElapsedMs: 150,
        })
      );
    });

    it("resets total elapsed time back to zero", () => {
      engine.start();
      jest.advanceTimersByTime(100);

      engine.reset();
      expect(engine.getElapsedMs()).toBe(0);

      engine.start();
      jest.advanceTimersByTime(50);

      expect(mockTickCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalElapsedMs: 50,
        })
      );
    });

    it("pauses interval loop and catches up wall-clock elapsed time", () => {
      engine.start();
      jest.advanceTimersByTime(100);

      // Pause loop as during app background
      engine.pauseLoop();
      const callsAtBackground = mockTickCallback.mock.calls.length;

      // Time advances by 5000ms while interval loop is paused
      jest.advanceTimersByTime(5000);
      expect(mockTickCallback.mock.calls.length).toBe(callsAtBackground);

      // Catch up upon returning to foreground
      const catchUpEvent = engine.catchUp();
      expect(catchUpEvent).toEqual({
        deltaMs: 5000,
        totalElapsedMs: 5100,
      });
      expect(mockTickCallback).toHaveBeenCalledWith(catchUpEvent);

      // Resume loop and advance time
      engine.resumeLoop();
      jest.advanceTimersByTime(50);
      expect(engine.getElapsedMs()).toBe(5150);
    });
  });

  describe("high Precision Mode (requestAnimationFrame loop)", () => {
    it("initializes with high precision when option is specified", () => {
      const hpEngine = new TickEngine({ highPrecision: true });
      expect(hpEngine.getIsHighPrecision()).toBe(true);

      const boolEngine = new TickEngine(true);
      expect(boolEngine.getIsHighPrecision()).toBe(true);
    });

    it("emits continuous ticks via requestAnimationFrame in high precision mode", () => {
      const hpEngine = new TickEngine({ highPrecision: true });
      const callback = jest.fn();
      hpEngine.onTickCallbacks.push(callback);

      hpEngine.start();
      jest.advanceTimersByTime(50);

      // In Jest fake timers, requestAnimationFrame schedules on millisecond intervals
      expect(callback).toHaveBeenCalledTimes(51);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          deltaMs: 1,
          totalElapsedMs: 50,
        })
      );
    });

    it("pauses and resumes correctly in high precision mode", () => {
      const hpEngine = new TickEngine({ highPrecision: true });
      const callback = jest.fn();
      hpEngine.onTickCallbacks.push(callback);

      hpEngine.start();
      jest.advanceTimersByTime(50);

      hpEngine.pause();
      const callsAfterPause = callback.mock.calls.length;

      jest.advanceTimersByTime(100);
      expect(callback.mock.calls.length).toBe(callsAfterPause);

      hpEngine.start();
      jest.advanceTimersByTime(50);
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          totalElapsedMs: 100,
        })
      );
    });
  });

  describe("dynamic Mode Switching & Monotonic Clock Drift Prevention", () => {
    it("dynamically switches between 20 Hz and high precision while running", () => {
      engine.start();

      // In 20 Hz mode: 50ms produces 1 tick
      jest.advanceTimersByTime(50);
      expect(mockTickCallback).toHaveBeenCalledTimes(1);

      // Switch to high precision while running
      engine.setHighPrecision(true);
      expect(engine.getIsHighPrecision()).toBe(true);

      // Next 50ms produces continuous RAF ticks
      jest.advanceTimersByTime(50);
      expect(mockTickCallback.mock.calls.length).toBeGreaterThan(20);

      // Switch back to standard 20 Hz mode
      engine.setHighPrecision(false);
      expect(engine.getIsHighPrecision()).toBe(false);

      const countBefore = mockTickCallback.mock.calls.length;
      jest.advanceTimersByTime(50);
      expect(mockTickCallback.mock.calls.length).toBe(countBefore + 1);
    });

    it("maintains monotonic delta accumulation via performance.now() without clock drift", () => {
      engine.start();

      jest.advanceTimersByTime(50);
      expect(engine.getElapsedMs()).toBe(50);

      jest.advanceTimersByTime(150);
      expect(engine.getElapsedMs()).toBe(200);

      // Switch mode - delta accumulation remains seamless and continuous
      engine.setHighPrecision(true);
      jest.advanceTimersByTime(50);
      expect(engine.getElapsedMs()).toBe(250);

      engine.setHighPrecision(false);
      jest.advanceTimersByTime(50);
      expect(engine.getElapsedMs()).toBe(300);
    });
  });
});
