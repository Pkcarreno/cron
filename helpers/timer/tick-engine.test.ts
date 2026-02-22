import { describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import { TickEngine } from '@/helpers/timer/tick-engine';

describe('tickEngine', () => {
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

  it('does not emit ticks before starting', () => {
    jest.advanceTimersByTime(100);
    expect(mockTickCallback).not.toHaveBeenCalled();
  });

  it('emits tick events with correct delta and total elapsed time when running', () => {
    engine.start();

    jest.advanceTimersByTime(50);

    expect(mockTickCallback).toHaveBeenCalledTimes(51);

    const [lastEventPayload] = mockTickCallback.mock.lastCall;

    expect(lastEventPayload.deltaMs).toBe(1);
    expect(lastEventPayload.totalElapsedMs).toBe(50);
  });

  it('stops emitting ticks after pause is called', () => {
    engine.start();
    jest.advanceTimersByTime(50);

    const callsBeforePause = mockTickCallback.mock.calls.length;

    engine.pause();
    jest.advanceTimersByTime(50);

    const callsAfterPause = mockTickCallback.mock.calls.length;

    expect(callsAfterPause).toBe(callsBeforePause);
  });

  it('resumes total elapsed time correctly after being paused', () => {
    engine.start();
    jest.advanceTimersByTime(100);
    engine.pause();

    jest.advanceTimersByTime(500);

    engine.start();
    jest.advanceTimersByTime(50);

    const [lastEventPayload] = mockTickCallback.mock.lastCall;

    expect(lastEventPayload.totalElapsedMs).toBe(150);
  });

  it('resets total elapsed time back to zero', () => {
    engine.start();
    jest.advanceTimersByTime(100);

    engine.reset();
    engine.start();
    jest.advanceTimersByTime(50);

    const [lastEventPayload] = mockTickCallback.mock.lastCall;

    expect(lastEventPayload.totalElapsedMs).toBe(50);
  });
});
