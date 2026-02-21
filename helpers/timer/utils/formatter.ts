import { TimerMode } from '@/helpers/timer/factory';

export const convertTimeToMs = (minutes: number, seconds = 0): number =>
  minutes * 60 * 1000 + seconds * 1000;

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
    minutes: minutes.toString().padStart(2, '0'),
    seconds: seconds.toString().padStart(2, '0'),
  };
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
    case TimerMode.TABATA: {
      return 'TAB';
    }
    case TimerMode.ON_OFF: {
      return 'O/F';
    }
    default: {
      return '---';
    }
  }
};
