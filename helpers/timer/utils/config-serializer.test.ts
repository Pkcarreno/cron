import { describe, expect, it } from "@jest/globals";

import type { TimerConfig } from "@/helpers/timer/factory";
import { TimerMode } from "@/helpers/timer/factory";
import type { TimerRouteParams } from "@/helpers/timer/utils/config-serializer";
import {
  amrapDefaults,
  DEFAULT_CONFIG_BY_MODE,
  DEFAULT_TIMER_CONFIG,
  deserializeTimerConfig,
  forTimeDefaults,
  serializeTimerConfig,
} from "@/helpers/timer/utils/config-serializer";

describe("config-serializer", () => {
  describe("serializeTimerConfig (Config -> Params)", () => {
    it("should convert numbers to strings while preserving 'mode'", () => {
      const config: TimerConfig = {
        durationMs: 240_000,
        mode: TimerMode.AMRAP,
      };

      const result = serializeTimerConfig(config);

      expect(result).toStrictEqual({
        durationMs: "240000",
        mode: TimerMode.AMRAP,
      });
    });

    it("should omit undefined properties", () => {
      const config: Partial<TimerConfig> = {
        // @ts-expect-error: Testing runtime behavior for explicitly undefined values
        durationMs: undefined,
        mode: TimerMode.EMOM,
      };

      const result = serializeTimerConfig(config as TimerConfig);

      expect(result).toStrictEqual({ mode: TimerMode.EMOM });
      expect(result).not.toHaveProperty("durationMs");
    });
  });

  describe("deserializeTimerConfig (Params -> Config)", () => {
    it("should parse strings to numbers while preserving 'mode'", () => {
      const params: TimerRouteParams = {
        durationMs: "240000",
        mode: TimerMode.AMRAP,
      };

      const result = deserializeTimerConfig(params);

      expect(result).toStrictEqual({
        durationMs: 240_000,
        mode: TimerMode.AMRAP,
      });
    });

    it("should parse all timer modes correctly", () => {
      expect(
        deserializeTimerConfig({
          mode: TimerMode.FOR_TIME,
          timecapMs: "180000",
        })
      ).toStrictEqual({
        mode: TimerMode.FOR_TIME,
        timecapMs: 180_000,
      });

      expect(
        deserializeTimerConfig({
          mode: TimerMode.EMOM,
          roundDurationMs: "60000",
          totalRounds: "5",
        })
      ).toStrictEqual({
        mode: TimerMode.EMOM,
        roundDurationMs: 60_000,
        totalRounds: 5,
      });

      expect(
        deserializeTimerConfig({
          mode: TimerMode.INTERVAL,
          restMs: "15000",
          totalRounds: "8",
          workMs: "45000",
        })
      ).toStrictEqual({
        mode: TimerMode.INTERVAL,
        restMs: 15_000,
        totalRounds: 8,
        workMs: 45_000,
      });

      expect(
        deserializeTimerConfig({
          mode: TimerMode.STOP_WATCH,
          uiTickResolutionMs: "100",
        })
      ).toStrictEqual({
        mode: TimerMode.STOP_WATCH,
        uiTickResolutionMs: 100,
      });
    });

    it("should handle array values from route parameters", () => {
      const result = deserializeTimerConfig({
        durationMs: ["300000"],
        mode: [TimerMode.AMRAP],
      });

      expect(result).toStrictEqual({
        durationMs: 300_000,
        mode: TimerMode.AMRAP,
      });
    });

    it("should fall back safely to mode defaults when parameters are invalid or missing", () => {
      const paramsWithMissingDuration: Partial<TimerRouteParams> = {
        durationMs: undefined,
        mode: TimerMode.AMRAP,
      };

      const resultMissing = deserializeTimerConfig(
        paramsWithMissingDuration as TimerRouteParams
      );

      expect(resultMissing).toStrictEqual({
        durationMs: amrapDefaults.durationMs,
        mode: TimerMode.AMRAP,
      });

      const paramsWithNegativeTimecap: TimerRouteParams = {
        mode: TimerMode.FOR_TIME,
        timecapMs: "-500",
      };

      const resultNegative = deserializeTimerConfig(paramsWithNegativeTimecap);
      expect(resultNegative).toStrictEqual({
        mode: TimerMode.FOR_TIME,
        timecapMs: forTimeDefaults.timecapMs,
      });

      const paramsWithInvalidEmom: TimerRouteParams = {
        mode: TimerMode.EMOM,
        roundDurationMs: "abc",
        totalRounds: "0",
      };

      const resultInvalidEmom = deserializeTimerConfig(paramsWithInvalidEmom);
      expect(resultInvalidEmom).toStrictEqual(
        DEFAULT_CONFIG_BY_MODE[TimerMode.EMOM]
      );
    });

    it("should fall back safely to DEFAULT_TIMER_CONFIG when mode is unknown or missing", () => {
      expect(deserializeTimerConfig(null)).toStrictEqual(DEFAULT_TIMER_CONFIG);
      expect(deserializeTimerConfig()).toStrictEqual(DEFAULT_TIMER_CONFIG);
      expect(deserializeTimerConfig({})).toStrictEqual(DEFAULT_TIMER_CONFIG);
      expect(
        deserializeTimerConfig({
          mode: "UNKNOWN_MODE",
        } as unknown as TimerRouteParams)
      ).toStrictEqual(DEFAULT_TIMER_CONFIG);
    });
  });
});
