import { describe, expect, it } from '@jest/globals';
import type { TimerConfig } from '@/helpers/timer/factory';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerRouteParams } from '@/helpers/timer/utils/config-serializer';
import {
  deserializeTimerConfig,
  serializeTimerConfig,
} from '@/helpers/timer/utils/config-serializer';

describe('config-serializer', () => {
  describe('serializeTimerConfig (Config -> Params)', () => {
    it("should convert numbers to strings while preserving 'mode'", () => {
      const config: TimerConfig = {
        durationMs: 240_000,
        mode: TimerMode.AMRAP,
        preparationMs: 10_000,
      };

      const result = serializeTimerConfig(config);

      expect(result).toStrictEqual({
        durationMs: '240000',
        mode: TimerMode.AMRAP,
        preparationMs: '10000',
      });
    });

    it('should omit undefined properties', () => {
      const config: Partial<TimerConfig> = {
        // @ts-expect-error: Testing runtime behavior for explicitly undefined values
        durationMs: undefined,
        mode: TimerMode.EMOM,
      };

      const result = serializeTimerConfig(config as TimerConfig);

      expect(result).toStrictEqual({ mode: TimerMode.EMOM });
      expect(result).not.toHaveProperty('durationMs');
    });
  });

  describe('deserializeTimerConfig (Params -> Config)', () => {
    it("should parse strings to numbers while preserving 'mode'", () => {
      const params: TimerRouteParams = {
        durationMs: '240000',
        mode: TimerMode.AMRAP,
        preparationMs: '10000',
      };

      const result = deserializeTimerConfig(params);

      expect(result).toStrictEqual({
        durationMs: 240_000,
        mode: TimerMode.AMRAP,
        preparationMs: 10_000,
      });
    });

    it('should omit undefined properties', () => {
      const params: Partial<TimerRouteParams> = {
        durationMs: undefined,
        mode: TimerMode.AMRAP,
      };

      const result = deserializeTimerConfig(params as TimerRouteParams);

      expect(result).toStrictEqual({ mode: TimerMode.AMRAP });
      expect(result).not.toHaveProperty('durationMs');
    });
  });
});
