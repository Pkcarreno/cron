import { describe, expect, it } from '@jest/globals';
import {
  convertTimeToMs,
  formatDuration,
  formatFullTimeToString,
  formatTimeForDisplay,
  getModeAbbreviation,
} from '@/helpers/timer/utils/formatter';
import { TimerMode } from '@/helpers/timer/factory';

describe('formatter', () => {
  describe('convertTimeToMs function', () => {
    it('returns total milliseconds when given only minutes', () => {
      const minutes = 5;
      const expectedMilliseconds = minutes * 60 * 1000;

      const result = convertTimeToMs(minutes);

      expect(result).toBe(expectedMilliseconds);
    });

    it('returns total milliseconds when given both minutes and seconds', () => {
      const minutes = 1;
      const seconds = 30;
      const expectedMilliseconds = minutes * 60 * 1000 + seconds * 1000;

      const result = convertTimeToMs(minutes, seconds);

      expect(result).toBe(expectedMilliseconds);
    });

    it('returns 0 when all params are 0', () => {
      const result = convertTimeToMs(0, 0);
      expect(result).toBe(0);
    });

    it('returns undefined for hours when includeHours is true but time is under 1 hour', () => {
      const totalMilliseconds = 300_000;
      const result = formatTimeForDisplay(totalMilliseconds, true);
      expect(result).toStrictEqual({
        hours: undefined,
        minutes: '05',
        seconds: '00',
      });
    });

    it('returns formatted hours when includeHours is true and time is exactly 1 hour', () => {
      const totalMilliseconds = 3_600_000;
      const result = formatTimeForDisplay(totalMilliseconds, true);
      expect(result).toStrictEqual({
        hours: '01',
        minutes: '00',
        seconds: '00',
      });
    });

    it('calculates hours, minutes, and seconds correctly when time exceeds an hour', () => {
      const totalMilliseconds = 4_530_000;
      const result = formatTimeForDisplay(totalMilliseconds, true);
      expect(result).toStrictEqual({
        hours: '01',
        minutes: '15',
        seconds: '30',
      });
    });
  });

  describe('formatTimeForDisplay function', () => {
    it('returns formatted object with exact minutes and zero seconds', () => {
      const totalMilliseconds = 300_000;

      const result = formatTimeForDisplay(totalMilliseconds);

      expect(result).toStrictEqual({ minutes: '05', seconds: '00' });
    });

    it('returns formatted object calculating both minutes and seconds', () => {
      const totalMilliseconds = 95_000;

      const result = formatTimeForDisplay(totalMilliseconds);

      expect(result).toStrictEqual({ minutes: '01', seconds: '35' });
    });

    it('prepends a leading zero to single-digit values', () => {
      const totalMilliseconds = 9000;

      const result = formatTimeForDisplay(totalMilliseconds);

      expect(result).toStrictEqual({ minutes: '00', seconds: '09' });
    });

    it('rounds up milliseconds to the nearest second', () => {
      const totalMilliseconds = 1200;

      const result = formatTimeForDisplay(totalMilliseconds);

      expect(result).toStrictEqual({ minutes: '00', seconds: '02' });
    });
  });

  describe('formatFullTimeToString function', () => {
    it('returns formatted object with exact zero hours, 5 minutes and zero seconds', () => {
      const totalMilliseconds = 300_000;

      const result = formatFullTimeToString(totalMilliseconds);

      expect(result).toBe('00:05:00');
    });

    it('returns formatted object calculating both minutes and seconds', () => {
      const totalMilliseconds = 95_000;

      const result = formatFullTimeToString(totalMilliseconds);

      expect(result).toBe('00:01:35');
    });

    it('prepends a leading zero to single-digit values', () => {
      const totalMilliseconds = 9000;

      const result = formatFullTimeToString(totalMilliseconds);

      expect(result).toBe('00:00:09');
    });

    it('rounds up milliseconds to the nearest second', () => {
      const totalMilliseconds = 1200;

      const result = formatFullTimeToString(totalMilliseconds);

      expect(result).toBe('00:00:02');
    });

    it('calculates hours, minutes, and seconds correctly', () => {
      const totalMilliseconds = 4_530_000;

      const result = formatFullTimeToString(totalMilliseconds);

      expect(result).toBe('01:15:30');
    });

    it('handles double-digit hours correctly', () => {
      const totalMilliseconds = 40_500_000;

      const result = formatFullTimeToString(totalMilliseconds);

      expect(result).toBe('11:15:00');
    });

    it('handles values over 24 hours cumulatively', () => {
      const totalMilliseconds = 90_065_000;

      const result = formatFullTimeToString(totalMilliseconds);

      expect(result).toBe('25:01:05');
    });
  });

  describe('formatDuration function', () => {
    it('formatea milisegundos correctamente (< 1000ms)', () => {
      expect(formatDuration(500, false)).toBe('500ms');
      expect(formatDuration(500, true)).toBe('+500ms');
      expect(formatDuration(-500, false)).toBe('-500ms');
      expect(formatDuration(-500, true)).toBe('-500ms');
    });

    it('formatea segundos y recorta ceros al final (< 60s)', () => {
      expect(formatDuration(4345, false)).toBe('4.345s');
      expect(formatDuration(4300, false)).toBe('4.3s');
      expect(formatDuration(4300, true)).toBe('+4.3s');
      expect(formatDuration(-4345, false)).toBe('-4.345s');
    });

    it('formatea minutos con precisión de dos decimales en los segundos (M:SS.ss)', () => {
      expect(formatDuration(330_340, false)).toBe('5:30.34');
      expect(formatDuration(330_340, true)).toBe('+5:30.34');
      expect(formatDuration(-330_340, false)).toBe('-5:30.34');
    });

    it('formatea horas con minutos y precisión de dos decimales en los segundos (H:MM:SS.ss)', () => {
      expect(formatDuration(3_930_340, false)).toBe('1:05:30.34');
      expect(formatDuration(3_930_340, true)).toBe('+1:05:30.34');
      expect(formatDuration(-3_930_340, false)).toBe('-1:05:30.34');
    });

    it('maneja el valor cero correctamente', () => {
      expect(formatDuration(0, false)).toBe('0ms');
      expect(formatDuration(0, true)).toBe('+0ms');
    });

    it('añade un cero inicial a los segundos si son menores a 10 en formato de minutos/horas', () => {
      expect(formatDuration(65_500, false)).toBe('1:05.50');
    });
  });

  describe('getModeAbbreviation function', () => {
    it('returns `AMR` for AMRAP mode', () => {
      const result = getModeAbbreviation(TimerMode.AMRAP);

      expect(result).toBe('AMR');
    });

    it('returns `FOR` for FOR_TIME mode', () => {
      const result = getModeAbbreviation(TimerMode.FOR_TIME);

      expect(result).toBe('FOR');
    });

    it('returns `EMO` for EMOM mode', () => {
      const result = getModeAbbreviation(TimerMode.EMOM);

      expect(result).toBe('EMO');
    });

    it('returns `INT` for INTERVAL mode', () => {
      const result = getModeAbbreviation(TimerMode.INTERVAL);

      expect(result).toBe('INT');
    });

    it('returns `STP` for STOP_WATCH mode', () => {
      const result = getModeAbbreviation(TimerMode.STOP_WATCH);

      expect(result).toBe('STP');
    });

    it('returns `---` when an unknown mode is provided', () => {
      // @ts-expect-error: Testing runtime behavior for unexpected mode value
      const result = getModeAbbreviation('test');

      expect(result).toBe('---');
    });
  });
});
