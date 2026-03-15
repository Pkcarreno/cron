import { DownStrategy } from '@/helpers/timer/strategies/down-strategy';
import { IntervalStrategy } from '@/helpers/timer/strategies/interval-strategy';
import { RoundStrategy } from '@/helpers/timer/strategies/round-strategy';
import { UpStrategy } from '@/helpers/timer/strategies/up-strategy';
import type { TimerStrategy } from '@/helpers/timer/strategy';
import { StopwatchStrategy } from '@/helpers/timer/strategies/stopwatch-strategy';

export enum TimerMode {
  FOR_TIME = 'FOR_TIME',
  AMRAP = 'AMRAP',
  EMOM = 'EMOM',
  INTERVAL = 'INTERVAL',
  STOP_WATCH = 'STOP_WATCH',
}

export const createTimerStrategy = (config: TimerConfig): TimerStrategy => {
  switch (config.mode) {
    case TimerMode.AMRAP: {
      return new DownStrategy(config.durationMs);
    }

    case TimerMode.FOR_TIME: {
      return new UpStrategy(config.timecapMs);
    }

    case TimerMode.EMOM: {
      return new RoundStrategy(config.roundDurationMs, config.totalRounds);
    }

    case TimerMode.INTERVAL: {
      return new IntervalStrategy(
        config.workMs,
        config.restMs,
        config.totalRounds
      );
    }

    case TimerMode.STOP_WATCH: {
      return new StopwatchStrategy();
    }

    default: {
      throw new Error('Timer mode not supported.');
    }
  }
};

export interface AmrapConfig {
  mode: TimerMode.AMRAP;
  durationMs: number;
}

export interface ForTimeConfig {
  mode: TimerMode.FOR_TIME;
  timecapMs: number;
}

export interface EmomConfig {
  mode: TimerMode.EMOM;
  roundDurationMs: number;
  totalRounds: number;
}

export interface IntervalConfig {
  mode: TimerMode.INTERVAL;
  workMs: number;
  restMs: number;
  totalRounds: number;
}

export interface StopWatchConfig {
  mode: TimerMode.STOP_WATCH;
}

export type TimerConfig =
  | AmrapConfig
  | ForTimeConfig
  | EmomConfig
  | IntervalConfig
  | StopWatchConfig;
