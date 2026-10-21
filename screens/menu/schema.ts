import { z } from "zod";

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

export const emomSchema = z.object({
  roundDurationMs: z.number().min(1, "Round duration must be at least 1ms"),
  totalRounds: z.number().min(1, "Rounds must be at least 1"),
}) satisfies z.ZodType<Omit<EmomConfig, "mode">>;

export const amrapSchema = z.object({
  durationMs: z.number().min(1, "Duration must be at least 1ms"),
}) satisfies z.ZodType<Omit<AmrapConfig, "mode">>;

export const intervalSchema = z.object({
  restMs: z.number().min(1, "Rest duration must be at least 1ms"),
  totalRounds: z.number().min(1, "Rounds must be at least 1"),
  workMs: z.number().min(1, "Work duration must be at least 1ms"),
}) satisfies z.ZodType<Omit<IntervalConfig, "mode">>;

export const forTimeSchema = z.object({
  timecapMs: z.number().min(1, "Time cap must be at least 1ms"),
}) satisfies z.ZodType<Omit<ForTimeConfig, "mode">>;

export const stopWatchSchema = z.object({
  uiTickResolutionMs: z.number().positive().optional(),
}) satisfies z.ZodType<Omit<StopWatchConfig, "mode">>;

export type EmomFormValues = z.infer<typeof emomSchema>;
export type AmrapFormValues = z.infer<typeof amrapSchema>;
export type IntervalFormValues = z.infer<typeof intervalSchema>;
export type ForTimeFormValues = z.infer<typeof forTimeSchema>;
export type StopWatchFormValues = z.infer<typeof stopWatchSchema>;

export interface FormHandle {
  submit: () => void;
}

export const TIMER_MODES = [
  TimerMode.FOR_TIME,
  TimerMode.AMRAP,
  TimerMode.INTERVAL,
  TimerMode.EMOM,
  TimerMode.STOP_WATCH,
];
