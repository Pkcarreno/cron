import { DownStrategy } from "@/helpers/timer/strategies/down-strategy";
import { IntervalStrategy } from "@/helpers/timer/strategies/interval-strategy";
import { RoundStrategy } from "@/helpers/timer/strategies/round-strategy";
import { StopwatchStrategy } from "@/helpers/timer/strategies/stopwatch-strategy";
import { UpStrategy } from "@/helpers/timer/strategies/up-strategy";
import type { TimerStrategy } from "@/helpers/timer/strategy";

export enum TimerMode {
  FOR_TIME = "FOR_TIME",
  AMRAP = "AMRAP",
  EMOM = "EMOM",
  INTERVAL = "INTERVAL",
  STOP_WATCH = "STOP_WATCH",
}

export const createTimerStrategy = (config: TimerConfig): TimerStrategy => {
  let strategy: TimerStrategy;

  switch (config.mode) {
    case TimerMode.AMRAP: {
      strategy = new DownStrategy(config.durationMs);
      break;
    }

    case TimerMode.FOR_TIME: {
      strategy = new UpStrategy(config.timecapMs);
      break;
    }

    case TimerMode.EMOM: {
      strategy = new RoundStrategy(config.roundDurationMs, config.totalRounds);
      break;
    }

    case TimerMode.INTERVAL: {
      strategy = new IntervalStrategy(
        config.workMs,
        config.restMs,
        config.totalRounds
      );
      break;
    }

    case TimerMode.STOP_WATCH: {
      strategy = new StopwatchStrategy();
      break;
    }

    default: {
      throw new Error("Timer mode not supported.");
    }
  }

  return strategy;
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
  uiTickResolutionMs?: number;
}

export type TimerConfig =
  | AmrapConfig
  | ForTimeConfig
  | EmomConfig
  | IntervalConfig
  | StopWatchConfig;
