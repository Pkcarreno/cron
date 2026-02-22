import { describe, expect, it } from '@jest/globals';
import type { TimerConfig } from '@/helpers/timer/factory';
import { createTimerStrategy, TimerMode } from '@/helpers/timer/factory';
import { DownStrategy } from '@/helpers/timer/strategies/down-strategy';
import { IntervalStrategy } from '@/helpers/timer/strategies/interval-strategy';
import { RoundStrategy } from '@/helpers/timer/strategies/round-strategy';
import { UpStrategy } from '@/helpers/timer/strategies/up-strategy';

describe('timerFactory', () => {
  const DEFAULT_PREPARATION_MS = 10_000;

  it('creates DownStrategy when mode is AMRAP', () => {
    const config: TimerConfig = {
      durationMs: 600_000,
      mode: TimerMode.AMRAP,
      preparationMs: DEFAULT_PREPARATION_MS,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(DownStrategy);
  });

  it('creates UpStrategy when mode is FOR_TIME', () => {
    const config: TimerConfig = {
      mode: TimerMode.FOR_TIME,
      preparationMs: DEFAULT_PREPARATION_MS,
      timecapMs: 1_200_000,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(UpStrategy);
  });

  it('creates RoundStrategy when mode is EMOM', () => {
    const config: TimerConfig = {
      mode: TimerMode.EMOM,
      preparationMs: DEFAULT_PREPARATION_MS,
      totalRounds: 10,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(RoundStrategy);
  });

  it('creates IntervalStrategy when mode is TABATA', () => {
    const config: TimerConfig = {
      mode: TimerMode.TABATA,
      preparationMs: DEFAULT_PREPARATION_MS,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(IntervalStrategy);
  });

  it('creates IntervalStrategy when mode is ON_OFF', () => {
    const config: TimerConfig = {
      mode: TimerMode.ON_OFF,
      preparationMs: DEFAULT_PREPARATION_MS,
      restMs: 30_000,
      totalRounds: 4,
      workMs: 30_000,
    };

    const strategy = createTimerStrategy(config);

    expect(strategy).toBeInstanceOf(IntervalStrategy);
  });

  it('throws error when wrong mode is inserted', () => {
    const config = {
      mode: 'demo',
      preparationMs: DEFAULT_PREPARATION_MS,
      totalRounds: 4,
    };

    // @ts-expect-error: Testing runtime behavior for explicitly wrong mode
    expect(() => createTimerStrategy(config)).toThrow(
      'Timer mode not supported.'
    );
  });
});
