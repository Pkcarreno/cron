import * as v from "valibot";

import type { TimerConfig } from "@/helpers/timer/factory";
import { TimerMode } from "@/helpers/timer/factory";

const coercedPositiveNumber = (minMessage: string) =>
  v.pipe(v.unknown(), v.toNumber(), v.number(), v.minValue(1, minMessage));

const coercedPositiveInteger = (minMessage: string) =>
  v.pipe(
    v.unknown(),
    v.toNumber(),
    v.number(),
    v.integer(),
    v.minValue(1, minMessage)
  );

export const amrapSchema = v.object({
  durationMs: coercedPositiveNumber("Duration must be at least 1 second"),
});

export const forTimeSchema = v.object({
  timecapMs: coercedPositiveNumber("Time cap must be at least 1 second"),
});

export const emomSchema = v.object({
  roundDurationMs: coercedPositiveNumber(
    "Round duration must be at least 1 second"
  ),
  totalRounds: coercedPositiveInteger("Rounds must be at least 1"),
});

export const intervalSchema = v.object({
  restMs: coercedPositiveNumber("Rest duration must be at least 1 second"),
  totalRounds: coercedPositiveInteger("Rounds must be at least 1"),
  workMs: coercedPositiveNumber("Work duration must be at least 1 second"),
});

export const stopWatchSchema = v.object({
  uiTickResolutionMs: v.optional(
    v.pipe(v.unknown(), v.toNumber(), v.number(), v.minValue(1))
  ),
});

export const amrapDefaults = {
  durationMs: 4 * 60 * 1000,
};

export const forTimeDefaults = {
  timecapMs: 3 * 60 * 1000,
};

export const emomDefaults = {
  roundDurationMs: 60 * 1000,
  totalRounds: 3,
};

export const intervalDefaults = {
  restMs: 20 * 1000,
  totalRounds: 3,
  workMs: 30 * 1000,
};

export const stopWatchDefaults = {};

export const DEFAULT_CONFIG_BY_MODE: Record<TimerMode, TimerConfig> = {
  [TimerMode.FOR_TIME]: {
    mode: TimerMode.FOR_TIME,
    ...forTimeDefaults,
  },
  [TimerMode.AMRAP]: {
    mode: TimerMode.AMRAP,
    ...amrapDefaults,
  },
  [TimerMode.EMOM]: {
    mode: TimerMode.EMOM,
    ...emomDefaults,
  },
  [TimerMode.INTERVAL]: {
    mode: TimerMode.INTERVAL,
    ...intervalDefaults,
  },
  [TimerMode.STOP_WATCH]: {
    mode: TimerMode.STOP_WATCH,
    ...stopWatchDefaults,
  },
};

export const DEFAULT_TIMER_CONFIG: TimerConfig =
  DEFAULT_CONFIG_BY_MODE[TimerMode.FOR_TIME];

export const timerConfigSchema = v.variant("mode", [
  v.object({
    durationMs: amrapSchema.entries.durationMs,
    mode: v.literal(TimerMode.AMRAP),
  }),
  v.object({
    mode: v.literal(TimerMode.FOR_TIME),
    timecapMs: forTimeSchema.entries.timecapMs,
  }),
  v.object({
    mode: v.literal(TimerMode.EMOM),
    roundDurationMs: emomSchema.entries.roundDurationMs,
    totalRounds: emomSchema.entries.totalRounds,
  }),
  v.object({
    mode: v.literal(TimerMode.INTERVAL),
    restMs: intervalSchema.entries.restMs,
    totalRounds: intervalSchema.entries.totalRounds,
    workMs: intervalSchema.entries.workMs,
  }),
  v.object({
    mode: v.literal(TimerMode.STOP_WATCH),
    uiTickResolutionMs: stopWatchSchema.entries.uiTickResolutionMs,
  }),
]);

export type TimerRouteParams = Partial<
  Record<string, string | string[] | undefined>
>;

export const deserializeTimerConfig = (
  params?: Record<string, unknown> | null
): TimerConfig => {
  if (!params || typeof params !== "object") {
    return DEFAULT_TIMER_CONFIG;
  }

  const normalizedParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      normalizedParams[key] = Array.isArray(value) ? value[0] : value;
    }
  }

  const rawMode = normalizedParams.mode;
  const isKnownMode =
    typeof rawMode === "string" &&
    Object.values(TimerMode).includes(rawMode as TimerMode);

  const fallbackForMode: TimerConfig = isKnownMode
    ? DEFAULT_CONFIG_BY_MODE[rawMode as TimerMode]
    : DEFAULT_TIMER_CONFIG;

  const parseResult = v.safeParse(timerConfigSchema, normalizedParams);
  if (parseResult.success) {
    return parseResult.output as TimerConfig;
  }

  return fallbackForMode;
};

export const serializeTimerConfig = (
  config: TimerConfig
): Record<string, string> => {
  const stringified: Record<string, string> = {};

  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) {
      stringified[key] = String(value);
    }
  }

  return stringified;
};
