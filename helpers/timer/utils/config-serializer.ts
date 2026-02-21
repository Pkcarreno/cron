import type { TimerConfig } from '@/helpers/timer/factory';

type StringifyParams<T> = {
  [K in keyof T]: K extends 'mode' ? T[K] : string;
};

export type TimerRouteParams = StringifyParams<TimerConfig>;

export const deserializeTimerConfig = (
  params: TimerRouteParams
): TimerConfig => {
  const parsed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      parsed[key] = key === 'mode' ? value : Number(value);
    }
  }

  return parsed as unknown as TimerConfig;
};

export const serializeTimerConfig = (config: TimerConfig): TimerRouteParams => {
  const stringified: Partial<StringifyParams<TimerConfig>> = {};

  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) {
      stringified[key as keyof StringifyParams<TimerConfig>] =
        key === 'mode' ? value : String(value);
    }
  }

  return stringified as StringifyParams<TimerConfig>;
};
