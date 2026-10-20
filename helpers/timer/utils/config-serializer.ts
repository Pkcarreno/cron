import { z } from "zod";

import type { TimerConfig } from "@/helpers/timer/factory";
import { TimerMode } from "@/helpers/timer/factory";

export const amrapSchema = z.object({
  durationMs: z.coerce.number().min(1, "Duration must be at least 1ms"),
});

export const forTimeSchema = z.object({
  timecapMs: z.coerce.number().min(1, "Time cap must be at least 1ms"),
});

export const emomSchema = z.object({
  roundDurationMs: z.coerce
    .number()
    .min(1, "Round duration must be at least 1ms"),
  totalRounds: z.coerce.number().int().min(1, "Rounds must be at least 1"),
});

export const intervalSchema = z.object({
  restMs: z.coerce.number().min(1, "Rest duration must be at least 1ms"),
  totalRounds: z.coerce.number().int().min(1, "Rounds must be at least 1"),
  workMs: z.coerce.number().min(1, "Work duration must be at least 1ms"),
});

export const stopWatchSchema = z.object({
  uiTickResolutionMs: z.coerce.number().positive().optional(),
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

export const timerConfigSchema = z.discriminatedUnion("mode", [
  z.object({
    durationMs: amrapSchema.shape.durationMs,
    mode: z.literal(TimerMode.AMRAP),
  }),
  z.object({
    mode: z.literal(TimerMode.FOR_TIME),
    timecapMs: forTimeSchema.shape.timecapMs,
  }),
  z.object({
    mode: z.literal(TimerMode.EMOM),
    roundDurationMs: emomSchema.shape.roundDurationMs,
    totalRounds: emomSchema.shape.totalRounds,
  }),
  z.object({
    mode: z.literal(TimerMode.INTERVAL),
    restMs: intervalSchema.shape.restMs,
    totalRounds: intervalSchema.shape.totalRounds,
    workMs: intervalSchema.shape.workMs,
  }),
  z.object({
    mode: z.literal(TimerMode.STOP_WATCH),
    uiTickResolutionMs: stopWatchSchema.shape.uiTickResolutionMs,
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

  const parseResult = timerConfigSchema.safeParse(normalizedParams);
  if (parseResult.success) {
    return parseResult.data as TimerConfig;
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
