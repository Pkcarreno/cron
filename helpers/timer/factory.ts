import { DownStrategy } from '@/helpers/timer/strategies/down-strategy';
import { IntervalStrategy } from '@/helpers/timer/strategies/interval-strategy';
import { RoundStrategy } from '@/helpers/timer/strategies/round-strategy';
import { UpStrategy } from '@/helpers/timer/strategies/up-strategy';
import type { TimerStrategy } from '@/helpers/timer/strategy';

export enum TimerMode {
  AMRAP = 'AMRAP',
  FOR_TIME = 'FOR_TIME',
  EMOM = 'EMOM',
  TABATA = 'TABATA',
  ON_OFF = 'ON_OFF',
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
      return new RoundStrategy(60 * 1000, config.totalRounds);
    }

    case TimerMode.TABATA: {
      return new IntervalStrategy(20 * 1000, 10 * 1000, 8);
    }

    case TimerMode.ON_OFF: {
      return new IntervalStrategy(
        config.workMs,
        config.restMs,
        config.totalRounds
      );
    }

    default: {
      throw new Error('Timer mode not supported.');
    }
  }
};

interface BaseTimerConfig {
  preparationMs: number;
}

export interface AmrapConfig extends BaseTimerConfig {
  mode: TimerMode.AMRAP;
  durationMs: number;
}

export interface ForTimeConfig extends BaseTimerConfig {
  mode: TimerMode.FOR_TIME;
  timecapMs: number;
}

export interface EmomConfig extends BaseTimerConfig {
  mode: TimerMode.EMOM;
  totalRounds: number;
}

export interface TabataConfig extends BaseTimerConfig {
  mode: TimerMode.TABATA;
}

export interface OnOffConfig extends BaseTimerConfig {
  mode: TimerMode.ON_OFF;
  workMs: number;
  restMs: number;
  totalRounds: number;
}

export type TimerConfig =
  | AmrapConfig
  | ForTimeConfig
  | EmomConfig
  | TabataConfig
  | OnOffConfig;
