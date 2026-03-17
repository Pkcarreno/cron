import { TimerMode } from '@/helpers/timer/factory';
import type {
  AmrapConfig,
  EmomConfig,
  ForTimeConfig,
  StopWatchConfig,
  IntervalConfig,
} from '@/helpers/timer/factory';
import { z } from 'zod';

export const emomSchema = z.object({
  roundDurationMs: z.number().min(1, 'Round duration must be at least 1ms'),
  totalRounds: z.number().min(1, 'Rounds must be at least 1'),
}) satisfies z.ZodType<Omit<EmomConfig, 'preparationMs' | 'mode'>>;

export const amrapSchema = z.object({
  durationMs: z.number().min(1, 'Duration must be at least 1ms'),
}) satisfies z.ZodType<Omit<AmrapConfig, 'preparationMs' | 'mode'>>;

export const intervalSchema = z.object({
  restMs: z.number().min(1, 'Rest duration must be at least 1ms'),
  totalRounds: z.number().min(1, 'Rounds must be at least 1'),
  workMs: z.number().min(1, 'Work duration must be at least 1ms'),
}) satisfies z.ZodType<Omit<IntervalConfig, 'preparationMs' | 'mode'>>;

export const forTimeSchema = z.object({
  timecapMs: z.number().min(1, 'Time cap must be at least 1ms'),
}) satisfies z.ZodType<Omit<ForTimeConfig, 'preparationMs' | 'mode'>>;

export const stopWatchSchema = z.object({}) satisfies z.ZodType<
  Omit<StopWatchConfig, 'preparationMs' | 'mode'>
>;

export const emomDefaults: z.infer<typeof emomSchema> = {
  roundDurationMs: 45 * 1000,
  totalRounds: 3,
};

export const amrapDefaults: z.infer<typeof amrapSchema> = {
  durationMs: 4 * 60 * 1000,
};

export const intervalDefaults: z.infer<typeof intervalSchema> = {
  restMs: 20 * 1000,
  totalRounds: 3,
  workMs: 30 * 1000,
};

export const forTimeDefaults: z.infer<typeof forTimeSchema> = {
  timecapMs: 3 * 60 * 1000,
};

export const stopWatchDefaults: z.infer<typeof stopWatchSchema> = {};

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
