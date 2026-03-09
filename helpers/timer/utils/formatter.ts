import { TimerMode } from '@/helpers/timer/factory';

export const convertTimeToMs = (minutes: number, seconds = 0): number =>
  minutes * 60 * 1000 + seconds * 1000;

const pad = (num: number) => num.toString().padStart(2, '0');

export const formatTimeForDisplay = (
  totalMs: number
): {
  minutes: string;
  seconds: string;
} => {
  const totalSeconds = Math.ceil(totalMs / 1000);
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
