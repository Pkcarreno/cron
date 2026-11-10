import * as v from "valibot";

import type {
  AmrapConfig,
  EmomConfig,
  ForTimeConfig,
  IntervalConfig,
  StopWatchConfig,
} from "@/helpers/timer/factory";
import { TimerMode } from "@/helpers/timer/factory";

export {
  amrapDefaults,
  emomDefaults,
  forTimeDefaults,
  intervalDefaults,
  stopWatchDefaults,
} from "@/helpers/timer/utils/config-serializer";

export const emomSchema = v.object({
  roundDurationMs: v.pipe(
    v.number(),
    v.minValue(1, "Round duration must be at least 1 second")
  ),
  totalRounds: v.pipe(v.number(), v.minValue(1, "Rounds must be at least 1")),
});

export const amrapSchema = v.object({
  durationMs: v.pipe(
    v.number(),
    v.minValue(1, "Duration must be at least 1 second")
  ),
});

export const intervalSchema = v.object({
  restMs: v.pipe(
    v.number(),
    v.minValue(1, "Rest duration must be at least 1 second")
  ),
  totalRounds: v.pipe(v.number(), v.minValue(1, "Rounds must be at least 1")),
  workMs: v.pipe(
    v.number(),
    v.minValue(1, "Work duration must be at least 1 second")
  ),
});

export const forTimeSchema = v.object({
  timecapMs: v.pipe(
    v.number(),
    v.minValue(1, "Time cap must be at least 1 second")
  ),
});

export const stopWatchSchema = v.object({
  uiTickResolutionMs: v.optional(v.pipe(v.number(), v.minValue(1))),
});

export type EmomFormValues = v.InferOutput<typeof emomSchema>;
export type AmrapFormValues = v.InferOutput<typeof amrapSchema>;
export type IntervalFormValues = v.InferOutput<typeof intervalSchema>;
export type ForTimeFormValues = v.InferOutput<typeof forTimeSchema>;
export type StopWatchFormValues = v.InferOutput<typeof stopWatchSchema>;

// Compile-time checks that form values match Omit<*Config, "mode">
type _AssertEmom =
  EmomFormValues extends Omit<EmomConfig, "mode"> ? true : false;
type _AssertAmrap =
  AmrapFormValues extends Omit<AmrapConfig, "mode"> ? true : false;
type _AssertInterval =
  IntervalFormValues extends Omit<IntervalConfig, "mode"> ? true : false;
type _AssertForTime =
  ForTimeFormValues extends Omit<ForTimeConfig, "mode"> ? true : false;
type _AssertStopWatch =
  StopWatchFormValues extends Omit<StopWatchConfig, "mode"> ? true : false;

export const TIMER_MODES = [
  TimerMode.FOR_TIME,
  TimerMode.AMRAP,
  TimerMode.INTERVAL,
  TimerMode.EMOM,
  TimerMode.STOP_WATCH,
];

export const schemasByMode = {
  [TimerMode.FOR_TIME]: forTimeSchema,
  [TimerMode.AMRAP]: amrapSchema,
  [TimerMode.INTERVAL]: intervalSchema,
  [TimerMode.EMOM]: emomSchema,
  [TimerMode.STOP_WATCH]: stopWatchSchema,
} as const;
