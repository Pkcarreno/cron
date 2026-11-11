import { createStore } from "jotai";

import { colors } from "@/helpers/colors";
import { TimerMode } from "@/helpers/timer/factory";
import { TimerPhase } from "@/helpers/timer/strategy";
import type { UICheckpoint } from "@/hooks/use-timer";
import {
  resetTimerSessionAtom,
  timerCheckpointsAtom,
  timerCheckpointsLoggedCountAtom,
  timerConfigAtom,
  timerContextBannerAtom,
  timerCurrentRoundAtom,
  timerDisplayTimeMsAtom,
  timerEndedAtAtom,
  timerIsFinishedAtom,
  timerPhaseAtom,
  timerQuickAccessInfoAtom,
  timerStartedAtAtom,
  timerSuccessfulPausesCountAtom,
} from "@/screens/timer/atoms";

describe("Timer Atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("timerContextBannerAtom (AMRAP Active Round)", () => {
    it("returns undefined label and value during PREPARATION phase", () => {
      store.set(timerConfigAtom, {
        durationMs: 600_000,
        mode: TimerMode.AMRAP,
      });
      store.set(timerPhaseAtom, TimerPhase.PREPARATION);
      store.set(timerCheckpointsAtom, []);

      const banner = store.get(timerContextBannerAtom);
      expect(banner.label).toBeUndefined();
      expect(banner.value).toBeUndefined();
    });

    it("displays RND 1 at the start of AMRAP workout with zero checkpoints", () => {
      store.set(timerConfigAtom, {
        durationMs: 600_000,
        mode: TimerMode.AMRAP,
      });
      store.set(timerPhaseAtom, TimerPhase.WORK);
      store.set(timerCheckpointsAtom, []);

      const banner = store.get(timerContextBannerAtom);
      expect(banner.label).toBe("RND");
      expect(banner.labelColor).toBe(colors.red);
      expect(banner.value).toBe(1);
    });

    it("increments to RND 2 upon registering the first checkpoint", () => {
      store.set(timerConfigAtom, {
        durationMs: 600_000,
        mode: TimerMode.AMRAP,
      });
      store.set(timerPhaseAtom, TimerPhase.WORK);

      const firstCheckpoint: UICheckpoint = {
        elapsedTimeMs: 45_000,
        lap: 1,
        lapDeltaMs: 0,
        lapDurationMs: 45_000,
        recordedAt: new Date(),
      };
      store.set(timerCheckpointsAtom, [firstCheckpoint]);

      const banner = store.get(timerContextBannerAtom);
      expect(banner.label).toBe("RND");
      expect(banner.value).toBe(2);
    });

    it("increments to RND 3 upon registering two checkpoints", () => {
      store.set(timerConfigAtom, {
        durationMs: 600_000,
        mode: TimerMode.AMRAP,
      });
      store.set(timerPhaseAtom, TimerPhase.WORK);

      const checkpoints: UICheckpoint[] = [
        {
          elapsedTimeMs: 45_000,
          lap: 1,
          lapDeltaMs: 0,
          lapDurationMs: 45_000,
          recordedAt: new Date(),
        },
        {
          elapsedTimeMs: 95_000,
          lap: 2,
          lapDeltaMs: 5000,
          lapDurationMs: 50_000,
          recordedAt: new Date(),
        },
      ];
      store.set(timerCheckpointsAtom, checkpoints);

      const banner = store.get(timerContextBannerAtom);
      expect(banner.label).toBe("RND");
      expect(banner.value).toBe(3);
    });
  });

  describe("timerQuickAccessInfoAtom (Stopwatch Active Lap & Delta)", () => {
    it("displays L01 without delta at the start of Stopwatch session", () => {
      store.set(timerConfigAtom, {
        mode: TimerMode.STOP_WATCH,
      });
      store.set(timerPhaseAtom, TimerPhase.WORK);
      store.set(timerCheckpointsAtom, []);

      const quickAccess = store.get(timerQuickAccessInfoAtom);
      expect(quickAccess).toContain("L01");
      expect(quickAccess).toHaveLength(1);
    });

    it("displays L02 and the delta of the first closed lap after 1 checkpoint", () => {
      store.set(timerConfigAtom, {
        mode: TimerMode.STOP_WATCH,
      });
      store.set(timerPhaseAtom, TimerPhase.WORK);

      const firstCheckpoint: UICheckpoint = {
        elapsedTimeMs: 30_000,
        lap: 1,
        lapDeltaMs: 0,
        lapDurationMs: 30_000,
        recordedAt: new Date(),
      };
      store.set(timerCheckpointsAtom, [firstCheckpoint]);

      const quickAccess = store.get(timerQuickAccessInfoAtom);
      expect(quickAccess).toContain("L02");
      // Delta for 1st checkpoint is 0 ms, formatted as 00:00 or duration
      expect(quickAccess.length).toBeGreaterThanOrEqual(2);
    });

    it("displays L03 and the lapDeltaMs of the latest closed lap after 2 checkpoints", () => {
      store.set(timerConfigAtom, {
        mode: TimerMode.STOP_WATCH,
      });
      store.set(timerPhaseAtom, TimerPhase.WORK);

      const checkpoints: UICheckpoint[] = [
        {
          elapsedTimeMs: 30_000,
          lap: 1,
          lapDeltaMs: 0,
          lapDurationMs: 30_000,
          recordedAt: new Date(),
        },
        {
          elapsedTimeMs: 75_000,
          lap: 2,
          lapDeltaMs: 15_000,
          lapDurationMs: 45_000,
          recordedAt: new Date(),
        },
      ];
      store.set(timerCheckpointsAtom, checkpoints);

      const quickAccess = store.get(timerQuickAccessInfoAtom);
      expect(quickAccess).toContain("L03");
      // Delta for 2nd checkpoint (+15.00s)
      expect(quickAccess).toContain("+15.00s");
    });
  });

  describe("resetTimerSessionAtom", () => {
    it("atomically purges all active session atoms back to initial default values", () => {
      // Seed store with residual session state
      store.set(timerCheckpointsAtom, [
        {
          elapsedTimeMs: 25_000,
          lap: 1,
          lapDeltaMs: 0,
          lapDurationMs: 25_000,
          recordedAt: new Date(),
        },
      ]);
      store.set(timerCurrentRoundAtom, 4);
      store.set(timerDisplayTimeMsAtom, 120_000);
      store.set(timerStartedAtAtom, new Date(1_000_000));
      store.set(timerEndedAtAtom, new Date(2_000_000));
      store.set(timerIsFinishedAtom, true);

      // Verify dirty state
      expect(store.get(timerCheckpointsAtom)).toHaveLength(1);
      expect(store.get(timerCurrentRoundAtom)).toBe(4);
      expect(store.get(timerDisplayTimeMsAtom)).toBe(120_000);
      expect(store.get(timerIsFinishedAtom)).toBe(true);

      // Execute atomic reset
      store.set(resetTimerSessionAtom);

      // Verify all atoms are clean
      expect(store.get(timerCheckpointsAtom)).toEqual([]);
      expect(store.get(timerCurrentRoundAtom)).toBe(0);
      expect(store.get(timerDisplayTimeMsAtom)).toBe(0);
      expect(store.get(timerStartedAtAtom)).toBeNull();
      expect(store.get(timerEndedAtAtom)).toBeNull();
      expect(store.get(timerIsFinishedAtom)).toBe(false);
    });
  });

  describe("timerSuccessfulPausesCountAtom", () => {
    it("initializes with 0 pauses and tracks increments correctly", () => {
      expect(store.get(timerSuccessfulPausesCountAtom)).toBe(0);
      store.set(timerSuccessfulPausesCountAtom, (prev) => prev + 1);
      expect(store.get(timerSuccessfulPausesCountAtom)).toBe(1);
      store.set(timerSuccessfulPausesCountAtom, (prev) => prev + 1);
      expect(store.get(timerSuccessfulPausesCountAtom)).toBe(2);
    });
  });

  describe("timerCheckpointsLoggedCountAtom", () => {
    it("initializes with 0 checkpoints and tracks increments correctly", () => {
      expect(store.get(timerCheckpointsLoggedCountAtom)).toBe(0);
      store.set(timerCheckpointsLoggedCountAtom, (prev) => prev + 1);
      expect(store.get(timerCheckpointsLoggedCountAtom)).toBe(1);
      store.set(timerCheckpointsLoggedCountAtom, (prev) => prev + 1);
      expect(store.get(timerCheckpointsLoggedCountAtom)).toBe(2);
    });
  });
});
