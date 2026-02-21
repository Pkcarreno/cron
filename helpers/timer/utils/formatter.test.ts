import { describe, expect, it } from '@jest/globals';
import {
  convertTimeToMs,
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

    it('returns `TAB` for TABATA mode', () => {
      const result = getModeAbbreviation(TimerMode.TABATA);

      expect(result).toBe('TAB');
    });

    it('returns `O/F` for ON_OFF mode', () => {
      const result = getModeAbbreviation(TimerMode.ON_OFF);

      expect(result).toBe('O/F');
    });

    it('returns `---` when an unknown mode is provided', () => {
      // @ts-expect-error: Testing runtime behavior for unexpected mode value
      const result = getModeAbbreviation('test');

      expect(result).toBe('---');
    });
  });
});
