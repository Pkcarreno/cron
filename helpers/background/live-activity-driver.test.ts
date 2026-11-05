import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { IosNoopLiveActivityDriver } from "@/helpers/background/ios-noop-driver";
import {
  AndroidForegroundDriver,
  createLiveActivityDriver,
  formatHeadline,
  formatSubtitle,
  getPhaseAccentColor,
  getSecondaryActionLabel,
} from "@/helpers/background/live-activity-driver";
import { TimerMode } from "@/helpers/timer/factory";
import { TimerPhase } from "@/helpers/timer/strategy";
import * as Module from "@/modules/cron-foreground-service";

describe("liveActivityDriver", () => {
  describe("formatHeadline", () => {
    it("formats preparation phase cleanly regardless of mode", () => {
      const headline = formatHeadline({
        currentRound: 0,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.PREPARATION,
        totalRounds: 8,
      });
      expect(headline).toBe("PREPARATION");
    });

    it("formats interval and emom rounds", () => {
      const workHeadline = formatHeadline({
        currentRound: 3,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.WORK,
        totalRounds: 8,
      });
      expect(workHeadline).toBe("WORK — Round 3/8");

      const restHeadline = formatHeadline({
        currentRound: 3,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.REST,
        totalRounds: 8,
      });
      expect(restHeadline).toBe("REST — Round 3/8");

      const emomHeadline = formatHeadline({
        currentRound: 2,
        mode: TimerMode.EMOM,
        phase: TimerPhase.WORK,
        totalRounds: 5,
      });
      expect(emomHeadline).toBe("WORK — Round 2/5");
    });

    it("formats AMRAP with active round", () => {
      const amrapHeadline = formatHeadline({
        currentRound: 5,
        mode: TimerMode.AMRAP,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(amrapHeadline).toBe("AMRAP — Round 5");
    });

    it("formats Stopwatch with active lap", () => {
      const lapHeadline = formatHeadline({
        currentRound: 4,
        mode: TimerMode.STOP_WATCH,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(lapHeadline).toBe("STOPWATCH — Lap 4");
    });

    it("formats For Time with cap duration", () => {
      const forTimeHeadline = formatHeadline({
        capDurationMs: 1_200_000,
        currentRound: 1,
        mode: TimerMode.FOR_TIME,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(forTimeHeadline).toBe("FOR TIME — Cap 20:00");
    });

    it("formats For Time without cap duration", () => {
      const forTimeHeadline = formatHeadline({
        currentRound: 1,
        mode: TimerMode.FOR_TIME,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(forTimeHeadline).toBe("FOR TIME");
    });
  });

  describe("formatSubtitle", () => {
    it("formats paused elapsed string when paused", () => {
      const subtitle = formatSubtitle({
        isPaused: true,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 30_000,
        pausedElapsedDisplayTime: "04:32",
      });
      expect(subtitle).toBe("Paused at 04:32");
    });

    it("formats immediate next phase duration when active", () => {
      const restSubtitle = formatSubtitle({
        isPaused: false,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 30_000,
      });
      expect(restSubtitle).toBe("Next: REST (30s)");

      const workSubtitle = formatSubtitle({
        isPaused: false,
        nextPhase: TimerPhase.WORK,
        nextPhaseDurationMs: 60_000,
      });
      expect(workSubtitle).toBe("Next: WORK (60s)");
    });

    it("returns empty string when there is no next phase", () => {
      const subtitle = formatSubtitle({
        isPaused: false,
        nextPhase: null,
      });
      expect(subtitle).toBe("");
    });
  });

  describe("getPhaseAccentColor", () => {
    it("returns emerald green (#008153) for WORK", () => {
      expect(getPhaseAccentColor(TimerPhase.WORK)).toBe("#008153");
    });

    it("returns amber orange (#E7801F) for REST and PREPARATION", () => {
      expect(getPhaseAccentColor(TimerPhase.REST)).toBe("#E7801F");
      expect(getPhaseAccentColor(TimerPhase.PREPARATION)).toBe("#E7801F");
    });
  });

  describe("getSecondaryActionLabel", () => {
    it("returns 'Record Round' strictly for AMRAP", () => {
      expect(getSecondaryActionLabel(TimerMode.AMRAP)).toBe("Record Round");
    });

    it("returns 'Lap' strictly for STOP_WATCH", () => {
      expect(getSecondaryActionLabel(TimerMode.STOP_WATCH)).toBe("Lap");
    });

    it("returns undefined for INTERVAL, EMOM, and FOR_TIME to prevent accidental pocket presses", () => {
      expect(getSecondaryActionLabel(TimerMode.INTERVAL)).toBeUndefined();
      expect(getSecondaryActionLabel(TimerMode.EMOM)).toBeUndefined();
      expect(getSecondaryActionLabel(TimerMode.FOR_TIME)).toBeUndefined();
    });
  });

  describe("AndroidForegroundDriver", () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it("starts the foreground service with formatted defaults", async () => {
      const startSpy = jest
        .spyOn(Module, "startForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver();
      await driver.start({
        currentRound: 3,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 30_000,
        phase: TimerPhase.WORK,
        phaseDurationMs: 60_000,
        targetTimestampMs: 1_700_000_000_000,
        totalRounds: 8,
      });

      expect(startSpy).toHaveBeenCalledWith({
        color: "#008153",
        headline: "WORK — Round 3/8",
        isPaused: false,
        secondaryLabel: undefined,
        subtitle: "Next: REST (30s)",
        targetTimestampMs: 1_700_000_000_000,
      });
      expect(driver.getIsActive()).toBe(true);
    });

    it("updates the foreground service when already active", async () => {
      jest.spyOn(Module, "startForegroundService").mockResolvedValue(true);
      const updateSpy = jest
        .spyOn(Module, "updateForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver();
      await driver.start({
        currentRound: 1,
        isPaused: false,
        mode: TimerMode.AMRAP,
        phase: TimerPhase.WORK,
        phaseDurationMs: 600_000,
        targetTimestampMs: 1_700_000_000_000,
        totalRounds: 1,
      });

      await driver.update({
        currentRound: 2,
        isPaused: false,
        mode: TimerMode.AMRAP,
        phase: TimerPhase.WORK,
        phaseDurationMs: 600_000,
        targetTimestampMs: 1_700_000_000_000,
        totalRounds: 1,
      });

      expect(updateSpy).toHaveBeenCalledWith({
        color: "#008153",
        headline: "AMRAP — Round 2",
        isPaused: false,
        secondaryLabel: "Record Round",
        subtitle: "",
        targetTimestampMs: 1_700_000_000_000,
      });
    });

    it("pauses the notification with frozen chronometer and static text", async () => {
      jest.spyOn(Module, "startForegroundService").mockResolvedValue(true);
      const updateSpy = jest
        .spyOn(Module, "updateForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver();
      await driver.start({
        currentRound: 3,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 30_000,
        phase: TimerPhase.WORK,
        phaseDurationMs: 60_000,
        targetTimestampMs: 1_700_000_000_000,
        totalRounds: 8,
      });

      await driver.pause("02:45");

      expect(updateSpy).toHaveBeenCalledWith({
        color: "#008153",
        headline: "WORK — Round 3/8",
        isPaused: true,
        secondaryLabel: undefined,
        subtitle: "Paused at 02:45",
        targetTimestampMs: 0,
      });
    });

    it("stops foreground service and clears active state", async () => {
      const stopSpy = jest
        .spyOn(Module, "stopForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver();
      await driver.stop();

      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(driver.getIsActive()).toBe(false);
      expect(driver.getLastPayload()).toBeNull();
    });

    it("attaches controller and routes notification actions", () => {
      let registeredListener:
        | ((event: Module.NotificationActionEvent) => void)
        | undefined;
      const removeSpy = jest.fn();

      jest
        .spyOn(Module, "addNotificationActionListener")
        // oxlint-disable-next-line typescript/no-explicit-any
        .mockImplementation((listener: any) => {
          registeredListener = listener;
          return { remove: removeSpy };
        });

      const mockController = {
        pause: jest.fn(),
        recordCheckpoint: jest.fn(),
        start: jest.fn(),
      };

      const driver = new AndroidForegroundDriver();
      // oxlint-disable-next-line typescript/no-explicit-any
      const detach = driver.attachController(mockController as any);

      expect(registeredListener).toBeDefined();

      const fireEvent = (action: Module.NotificationActionType) => {
        if (registeredListener) {
          registeredListener({ action });
        }
      };

      fireEvent("pause");
      expect(mockController.pause).toHaveBeenCalledTimes(1);

      fireEvent("resume");
      expect(mockController.start).toHaveBeenCalledTimes(1);

      fireEvent("checkpoint");
      expect(mockController.recordCheckpoint).toHaveBeenCalledTimes(1);

      detach();
      expect(removeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("IosNoopLiveActivityDriver", () => {
    it("handles all driver calls without error", async () => {
      const driver = new IosNoopLiveActivityDriver();
      await expect(
        driver.start({
          currentRound: 1,
          isPaused: false,
          mode: TimerMode.INTERVAL,
          phase: TimerPhase.WORK,
          phaseDurationMs: 60_000,
          targetTimestampMs: 1_700_000_000_000,
          totalRounds: 1,
        })
      ).resolves.toBeUndefined();

      await expect(
        driver.update({
          currentRound: 1,
          isPaused: false,
          mode: TimerMode.INTERVAL,
          phase: TimerPhase.WORK,
          phaseDurationMs: 60_000,
          targetTimestampMs: 1_700_000_000_000,
          totalRounds: 1,
        })
      ).resolves.toBeUndefined();

      await expect(driver.pause("01:00")).resolves.toBeUndefined();
      await expect(driver.stop()).resolves.toBeUndefined();
      // oxlint-disable-next-line typescript/no-explicit-any
      const detach = driver.attachController({} as any);
      expect(detach).toBeDefined();
    });
  });

  describe("createLiveActivityDriver", () => {
    it("returns AndroidForegroundDriver on android", () => {
      const driver = createLiveActivityDriver("android");
      expect(driver).toBeInstanceOf(AndroidForegroundDriver);
    });

    it("returns IosNoopLiveActivityDriver on ios and other platforms", () => {
      const iosDriver = createLiveActivityDriver("ios");
      expect(iosDriver).toBeInstanceOf(IosNoopLiveActivityDriver);

      const webDriver = createLiveActivityDriver("web");
      expect(webDriver).toBeInstanceOf(IosNoopLiveActivityDriver);
    });
  });
});
