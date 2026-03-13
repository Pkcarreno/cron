import { TimerMode } from '@/helpers/timer/factory';

export const convertTimeToMs = (minutes: number, seconds = 0): number =>
  minutes * 60 * 1000 + seconds * 1000;

const pad = (num: number) => num.toString().padStart(2, '0');

export const formatTimeForDisplay = (
  totalMs: number,
  includeHours = false
): {
  hours?: string;
  minutes: string;
  seconds: string;
} => {
  const totalSeconds = Math.ceil(totalMs / 1000);

  if (includeHours) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      hours: hours === 0 ? undefined : pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
    };
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    minutes: pad(minutes),
    seconds: pad(seconds),
  };
};

export const formatFullTimeToString = (totalMs: number) => {
  const totalSeconds = Math.ceil(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

// oxlint-disable eslint/max-statements
export const formatDuration = (ms: number, showSign = false): string => {
  const isNegative = ms < 0;
  const absMs = Math.abs(ms);

  let sign = '';
  if (showSign) {
    sign = isNegative ? '-' : '+';
  } else if (isNegative) {
    sign = '-';
  }

  if (absMs < 1000) {
    return `${sign}${absMs}ms`;
  }

  const totalSeconds = absMs / 1000;

  if (totalSeconds < 60) {
    return `${sign}${Number.parseFloat(totalSeconds.toFixed(3))}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  const formattedSeconds =
    (remainingSeconds < 10 ? '0' : '') + remainingSeconds.toFixed(2);

  if (totalMinutes < 60) {
    return `${sign}${totalMinutes}:${formattedSeconds}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = Math.floor(totalMinutes % 60)
    .toString()
    .padStart(2, '0');

  return `${sign}${hours}:${remainingMinutes}:${formattedSeconds}`;
};

export const getModeAbbreviation = (mode: TimerMode): string => {
  switch (mode) {
    case TimerMode.AMRAP: {
      return 'AMR';
    }
    case TimerMode.FOR_TIME: {
      return 'FOR';
    }
    case TimerMode.EMOM: {
      return 'EMO';
    }
    case TimerMode.INTERVAL: {
      return 'INT';
    }
    case TimerMode.STOP_WATCH: {
      return 'STP';
    }
    default: {
      return '---';
    }
  }
};
