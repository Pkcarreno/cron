import { describe, expect, it } from '@jest/globals';
import type { TimerConfig } from '@/helpers/timer/factory';
import { createTimerStrategy, TimerMode } from '@/helpers/timer/factory';
import { DownStrategy } from '@/helpers/timer/strategies/down-strategy';
import { IntervalStrategy } from '@/helpers/timer/strategies/interval-strategy';
import { RoundStrategy } from '@/helpers/timer/strategies/round-strategy';
import { UpStrategy } from '@/helpers/timer/strategies/up-strategy';
import { StopwatchStrategy } from '@/helpers/timer/strategies/stopwatch-strategy';

describe('timerFactory', () => {
  it('creates DownStrategy when mode is AMRAP', () => {
    const config: TimerConfig = {
      durationMs: 600_000,
      mode: TimerMode.AMRAP,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(DownStrategy);
  });

  it('creates UpStrategy when mode is FOR_TIME', () => {
    const config: TimerConfig = {
      mode: TimerMode.FOR_TIME,
      timecapMs: 1_200_000,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(UpStrategy);
  });

  it('creates RoundStrategy when mode is EMOM', () => {
    const config: TimerConfig = {
      mode: TimerMode.EMOM,
      roundDurationMs: 600_000,
      totalRounds: 10,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(RoundStrategy);
  });

  it('creates IntervalStrategy when mode is INTERVAL', () => {
    const config: TimerConfig = {
      mode: TimerMode.INTERVAL,
      restMs: 30_000,
      totalRounds: 4,
      workMs: 30_000,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(IntervalStrategy);
  });

  it('creates StopWatchStrategy when mode is STOP_WATCH', () => {
    const config: TimerConfig = {
      mode: TimerMode.STOP_WATCH,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(StopwatchStrategy);
  });

  it('throws error when wrong mode is inserted', () => {
    const config = {
      mode: 'demo',
      totalRounds: 4,
    };

    // @ts-expect-error: Testing runtime behavior for explicitly wrong mode
    expect(() => createTimerStrategy(config)).toThrow(
      'Timer mode not supported.'
    );
  });
});
