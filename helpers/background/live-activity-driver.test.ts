import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { IosNoopLiveActivityDriver } from "@/helpers/background/ios-noop-driver";
import {
  AndroidForegroundDriver,
  createLiveActivityDriver,
  formatChip,
  formatClockDuration,
  formatHeadline,
  formatModePrefix,
  formatStaticCardHeadline,
  formatSubtitle,
  formatTier2Headline,
  getPhaseAccentColor,
  getSecondaryActionLabel,
} from "@/helpers/background/live-activity-driver";
import { TimerMode } from "@/helpers/timer/factory";
import { TimerPhase } from "@/helpers/timer/strategy";
import * as Module from "@/modules/cron-foreground-service/index";

describe("liveActivityDriver", () => {
  describe("formatClockDuration", () => {
    it("formats standard clock duration with two-digit minutes", () => {
      expect(formatClockDuration(20_000)).toBe("00:20");
      expect(formatClockDuration(60_000)).toBe("01:00");
      expect(formatClockDuration(600_000)).toBe("10:00");
      expect(formatClockDuration(3_665_000)).toBe("01:01:05");
    });

    it("formats compact duration with single-digit minutes when less than 10", () => {
      expect(formatClockDuration(20_000, true)).toBe("0:20");
      expect(formatClockDuration(60_000, true)).toBe("1:00");
      expect(formatClockDuration(600_000, true)).toBe("10:00");
      expect(formatClockDuration(3_665_000, true)).toBe("01:01:05");
    });

    it("handles zero or negative duration safely", () => {
      expect(formatClockDuration(0)).toBe("00:00");
      expect(formatClockDuration(-500, true)).toBe("0:00");
    });
  });

  describe("formatHeadline", () => {
    it("formats preparation phase cleanly without static duration", () => {
      const headline = formatHeadline({
        currentRound: 0,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.PREPARATION,
        phaseDurationMs: 10_000,
        totalRounds: 8,
      });
      expect(headline).toBe("PREPARATION");
    });

    it("formats interval and emom rounds with active phase", () => {
      const workHeadline = formatHeadline({
        currentRound: 3,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.WORK,
        phaseDurationMs: 20_000,
        totalRounds: 8,
      });
      expect(workHeadline).toBe("Round 3/8 | WORK");

      const restHeadline = formatHeadline({
        currentRound: 3,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.REST,
        phaseDurationMs: 10_000,
        totalRounds: 8,
      });
      expect(restHeadline).toBe("Round 3/8 | REST");

      const emomHeadline = formatHeadline({
        currentRound: 2,
        mode: TimerMode.EMOM,
        phase: TimerPhase.WORK,
        phaseDurationMs: 60_000,
        totalRounds: 5,
      });
      expect(emomHeadline).toBe("Round 2/5 | WORK");
    });

    it("formats AMRAP with active round", () => {
      const amrapHeadline = formatHeadline({
        capDurationMs: 600_000,
        currentRound: 5,
        mode: TimerMode.AMRAP,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(amrapHeadline).toBe("Round 5 | WORK");
    });

    it("formats Stopwatch with active lap or base state", () => {
      const baseHeadline = formatHeadline({
        currentRound: 1,
        mode: TimerMode.STOP_WATCH,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(baseHeadline).toBe("STOPWATCH");

      const lapHeadline = formatHeadline({
        currentRound: 4,
        mode: TimerMode.STOP_WATCH,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(lapHeadline).toBe("Lap 4 | STOPWATCH");
    });

    it("formats For Time simply as WORK", () => {
      const withCap = formatHeadline({
        capDurationMs: 1_200_000,
        currentRound: 1,
        mode: TimerMode.FOR_TIME,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(withCap).toBe("WORK");

      const noCap = formatHeadline({
        currentRound: 1,
        mode: TimerMode.FOR_TIME,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(noCap).toBe("WORK");
    });
  });

  describe("formatStaticCardHeadline", () => {
    it("is aliased by formatTier2Headline for backwards compatibility", () => {
      expect(formatTier2Headline).toBe(formatStaticCardHeadline);
    });

    it("formats preparation phase with static duration", () => {
      const headline = formatStaticCardHeadline({
        currentRound: 0,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.PREPARATION,
        phaseDurationMs: 10_000,
        totalRounds: 8,
      });
      expect(headline).toBe("PREPARATION (00:10)");
    });

    it("formats interval work and rest with static duration", () => {
      const workHeadline = formatTier2Headline({
        currentRound: 3,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.WORK,
        phaseDurationMs: 20_000,
        totalRounds: 8,
      });
      expect(workHeadline).toBe("Round 3/8 | WORK (00:20)");

      const restHeadline = formatTier2Headline({
        currentRound: 3,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.REST,
        phaseDurationMs: 10_000,
        totalRounds: 8,
      });
      expect(restHeadline).toBe("Round 3/8 | REST (00:10)");
    });

    it("formats AMRAP with remaining display time", () => {
      const amrapHeadline = formatTier2Headline({
        capDurationMs: 600_000,
        currentRound: 5,
        displayTimeMs: 570_000,
        mode: TimerMode.AMRAP,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(amrapHeadline).toBe("Round 5 | WORK (09:30)");
    });

    it("formats Stopwatch with elapsed duration", () => {
      const lapHeadline = formatTier2Headline({
        currentRound: 2,
        displayTimeMs: 75_000,
        mode: TimerMode.STOP_WATCH,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(lapHeadline).toBe("Lap 2 | STOPWATCH (01:15)");
    });

    it("formats For Time with remaining duration", () => {
      const forTimeHeadline = formatTier2Headline({
        currentRound: 1,
        displayTimeMs: 300_000,
        mode: TimerMode.FOR_TIME,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(forTimeHeadline).toBe("WORK (05:00)");
    });
  });

  describe("formatChip", () => {
    it("formats compact chip for preparation phase", () => {
      const chip = formatChip({
        currentRound: 0,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.PREPARATION,
        phaseDurationMs: 10_000,
        totalRounds: 8,
      });
      expect(chip).toBe("PREP");
    });

    it("formats compact chip for interval and emom", () => {
      const workChip = formatChip({
        currentRound: 3,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.WORK,
        phaseDurationMs: 20_000,
        totalRounds: 8,
      });
      expect(workChip).toBe("3 | WORK");

      const restChip = formatChip({
        currentRound: 3,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.REST,
        phaseDurationMs: 10_000,
        totalRounds: 8,
      });
      expect(restChip).toBe("3 | REST");

      const emomChip = formatChip({
        currentRound: 4,
        mode: TimerMode.EMOM,
        phase: TimerPhase.WORK,
        phaseDurationMs: 60_000,
        totalRounds: 10,
      });
      expect(emomChip).toBe("4 | WORK");
    });

    it("formats compact chip for AMRAP, For Time, and Stopwatch", () => {
      const amrapChip = formatChip({
        capDurationMs: 600_000,
        currentRound: 3,
        mode: TimerMode.AMRAP,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(amrapChip).toBe("3 | WORK");

      const forTimeCapChip = formatChip({
        capDurationMs: 900_000,
        currentRound: 1,
        mode: TimerMode.FOR_TIME,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(forTimeCapChip).toBe("WORK");

      const forTimeNoCapChip = formatChip({
        currentRound: 1,
        mode: TimerMode.FOR_TIME,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(forTimeNoCapChip).toBe("WORK");

      const stopwatchBase = formatChip({
        currentRound: 1,
        mode: TimerMode.STOP_WATCH,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(stopwatchBase).toBe("STOPWATCH");

      const stopwatchLap = formatChip({
        currentRound: 2,
        mode: TimerMode.STOP_WATCH,
        phase: TimerPhase.WORK,
        totalRounds: 1,
      });
      expect(stopwatchLap).toBe("2 | STOPWATCH");
    });
  });

  describe("formatSubtitle", () => {
    it("formats paused elapsed string with mode prefix", () => {
      const subtitle = formatSubtitle({
        isPaused: true,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 30_000,
        pausedElapsedDisplayTime: "04:32",
      });
      expect(subtitle).toBe("Interval. Paused at 04:32");
    });

    it("formats immediate next phase duration with mode prefix when active", () => {
      const restSubtitle = formatSubtitle({
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 30_000,
      });
      expect(restSubtitle).toBe("Interval. Next: REST (00:30)");

      const workSubtitle = formatSubtitle({
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.WORK,
        nextPhaseDurationMs: 60_000,
      });
      expect(workSubtitle).toBe("Interval. Next: WORK (01:00)");
    });

    it("formats cap duration when no next phase exists", () => {
      const forTimeSubtitle = formatSubtitle({
        capDurationMs: 900_000,
        isPaused: false,
        mode: TimerMode.FOR_TIME,
      });
      expect(forTimeSubtitle).toBe("For Time. Cap: 15:00");
    });

    it("returns clean mode name when there is no next phase and no cap", () => {
      const subtitle = formatSubtitle({
        isPaused: false,
        mode: TimerMode.STOP_WATCH,
        nextPhase: null,
      });
      expect(subtitle).toBe("Stopwatch.");
    });
  });

  describe("formatModePrefix", () => {
    it("returns formatted prefix for each supported timer mode", () => {
      expect(formatModePrefix(TimerMode.INTERVAL)).toBe("Interval. ");
      expect(formatModePrefix(TimerMode.EMOM)).toBe("EMOM. ");
      expect(formatModePrefix(TimerMode.AMRAP)).toBe("AMRAP. ");
      expect(formatModePrefix(TimerMode.FOR_TIME)).toBe("For Time. ");
      expect(formatModePrefix(TimerMode.STOP_WATCH)).toBe("Stopwatch. ");
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

      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "#008153",
          headline: "Round 3/8 | WORK",
          isPaused: false,
          secondaryLabel: undefined,
          subText: undefined,
          subtitle: "Interval. Next: REST (00:30)",
          supportsLiveUpdates: true,
          targetTimestampMs: 1_700_000_000_000,
        })
      );
      expect(driver.getIsActive()).toBe(true);
    });

    it("updates the foreground service when already active", async () => {
      jest.spyOn(Module, "startForegroundService").mockResolvedValue(true);
      const updateSpy = jest
        .spyOn(Module, "updateForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver();
      await driver.start({
        capDurationMs: 600_000,
        currentRound: 1,
        isPaused: false,
        mode: TimerMode.AMRAP,
        phase: TimerPhase.WORK,
        phaseDurationMs: 600_000,
        targetTimestampMs: 1_700_000_000_000,
        totalRounds: 1,
      });

      await driver.update({
        capDurationMs: 600_000,
        currentRound: 2,
        isPaused: false,
        mode: TimerMode.AMRAP,
        phase: TimerPhase.WORK,
        phaseDurationMs: 600_000,
        targetTimestampMs: 1_700_000_000_000,
        totalRounds: 1,
      });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "#008153",
          headline: "Round 2 | WORK",
          isPaused: false,
          secondaryLabel: "Record Round",
          subText: undefined,
          subtitle: "AMRAP. Cap: 10:00",
          supportsLiveUpdates: true,
          targetTimestampMs: 1_700_000_000_000,
        })
      );
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

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "#008153",
          headline: "Round 3/8 | WORK",
          isPaused: true,
          secondaryLabel: undefined,
          subText: undefined,
          subtitle: "Interval. Paused at 02:45",
          supportsLiveUpdates: true,
          targetTimestampMs: 0,
        })
      );
    });

    it("omits secondary action label during PREPARATION phase even for AMRAP", async () => {
      const startSpy = jest
        .spyOn(Module, "startForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver();
      await driver.start({
        currentRound: 0,
        isPaused: false,
        mode: TimerMode.AMRAP,
        nextPhase: TimerPhase.WORK,
        nextPhaseDurationMs: 600_000,
        phase: TimerPhase.PREPARATION,
        phaseDurationMs: 10_000,
        targetTimestampMs: 1_700_000_010_000,
        totalRounds: 1,
      });

      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: "PREPARATION",
          secondaryLabel: undefined,
        })
      );
    });

    it("resumes the notification with active chronometer countdown and recalculated target", async () => {
      jest.spyOn(Module, "startForegroundService").mockResolvedValue(true);
      const updateSpy = jest
        .spyOn(Module, "updateForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver();
      await driver.start({
        currentRound: 1,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 30_000,
        phase: TimerPhase.WORK,
        phaseDurationMs: 60_000,
        targetTimestampMs: 1_700_000_000_000,
        totalRounds: 8,
      });

      await driver.pause("00:45");

      await driver.resume({
        currentRound: 1,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 30_000,
        phase: TimerPhase.WORK,
        phaseDurationMs: 60_000,
        targetTimestampMs: 1_700_000_045_000,
        totalRounds: 8,
      });

      expect(updateSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          headline: "Round 1/8 | WORK",
          isPaused: false,
          targetTimestampMs: 1_700_000_045_000,
        })
      );
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

    it("provides milestone bridge and checks notification permission", async () => {
      const driver = new AndroidForegroundDriver();
      const bridge = driver.getMilestoneBridge();
      expect(bridge).toBeDefined();
      expect(typeof bridge.scheduleMilestones).toBe("function");
      expect(typeof bridge.clearMilestones).toBe("function");
      expect(typeof bridge.addMilestoneListener).toBe("function");

      const permissionSpy = jest
        .spyOn(Module, "hasNotificationPermission")
        .mockResolvedValue(true);
      const hasPermission = await driver.hasNotificationPermission();
      expect(hasPermission).toBe(true);
      expect(permissionSpy).toHaveBeenCalledTimes(1);
    });

    it("manages supportsLiveUpdates state and checks native platform support", async () => {
      const defaultDriver = new AndroidForegroundDriver();
      expect(defaultDriver.getSupportsLiveUpdates()).toBe(true);

      const falseDriver = new AndroidForegroundDriver({
        supportsLiveUpdates: false,
      });
      expect(falseDriver.getSupportsLiveUpdates()).toBe(false);

      falseDriver.setSupportsLiveUpdates(true);
      expect(falseDriver.getSupportsLiveUpdates()).toBe(true);

      const areSupportedSpy = jest
        .spyOn(Module, "areLiveUpdatesSupported")
        .mockResolvedValue(false);

      const result = await defaultDriver.areLiveUpdatesSupported();
      expect(result).toBe(false);
      expect(defaultDriver.getSupportsLiveUpdates()).toBe(false);
      expect(areSupportedSpy).toHaveBeenCalledTimes(1);
    });

    it("formats Tier 2 standard notification with clean headline and active hardware chronometer when live updates (status bar chip) are disabled", async () => {
      const startSpy = jest
        .spyOn(Module, "startForegroundService")
        .mockResolvedValue(true);
      const updateSpy = jest
        .spyOn(Module, "updateForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver({
        supportsLiveUpdates: false,
      });

      await driver.start({
        currentRound: 1,
        isCountDown: true,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 15_000,
        phase: TimerPhase.WORK,
        phaseDurationMs: 30_000,
        targetTimestampMs: 1_700_000_030_000,
        totalRounds: 5,
      });

      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: "Round 1/5 | WORK",
          isCountDown: true,
          supportsLiveUpdates: false,
          targetTimestampMs: 1_700_000_030_000,
          useChronometer: true,
        })
      );

      await driver.update({
        currentRound: 1,
        isCountDown: true,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.WORK,
        nextPhaseDurationMs: 30_000,
        phase: TimerPhase.REST,
        phaseDurationMs: 15_000,
        targetTimestampMs: 1_700_000_045_000,
        totalRounds: 5,
      });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: "Round 1/5 | REST",
          isCountDown: true,
          supportsLiveUpdates: false,
          targetTimestampMs: 1_700_000_045_000,
          useChronometer: true,
        })
      );
    });

    it("formats Tier 3 static notification card and suppresses chronometer when useChronometer is explicitly false", async () => {
      const startSpy = jest
        .spyOn(Module, "startForegroundService")
        .mockResolvedValue(true);
      const updateSpy = jest
        .spyOn(Module, "updateForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver({
        useChronometer: false,
      });

      await driver.start({
        currentRound: 1,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.REST,
        nextPhaseDurationMs: 15_000,
        phase: TimerPhase.WORK,
        phaseDurationMs: 30_000,
        targetTimestampMs: 1_700_000_030_000,
        totalRounds: 5,
      });

      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: "Round 1/5 | WORK (00:30)",
          isCountDown: false,
          targetTimestampMs: 0,
          useChronometer: false,
        })
      );

      await driver.update({
        currentRound: 1,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        nextPhase: TimerPhase.WORK,
        nextPhaseDurationMs: 30_000,
        phase: TimerPhase.REST,
        phaseDurationMs: 15_000,
        targetTimestampMs: 1_700_000_045_000,
        totalRounds: 5,
      });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: "Round 1/5 | REST (00:15)",
          isCountDown: false,
          targetTimestampMs: 0,
          useChronometer: false,
        })
      );
    });

    it("freezes chronometer and preserves clean headline in Tier 2 pause", async () => {
      jest.spyOn(Module, "startForegroundService").mockResolvedValue(true);
      const updateSpy = jest
        .spyOn(Module, "updateForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver({
        supportsLiveUpdates: false,
      });

      await driver.start({
        currentRound: 1,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.WORK,
        phaseDurationMs: 60_000,
        targetTimestampMs: 1_700_000_060_000,
        totalRounds: 5,
      });

      await driver.pause("00:35", 25_000);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: "Round 1/5 | WORK",
          isPaused: true,
          subtitle: "Interval. Paused at 00:35",
          targetTimestampMs: 0,
          useChronometer: true,
        })
      );
    });

    it("updates Tier 3 static headline with frozen remaining duration upon pause", async () => {
      jest.spyOn(Module, "startForegroundService").mockResolvedValue(true);
      const updateSpy = jest
        .spyOn(Module, "updateForegroundService")
        .mockResolvedValue(true);

      const driver = new AndroidForegroundDriver({
        useChronometer: false,
      });

      await driver.start({
        currentRound: 1,
        isPaused: false,
        mode: TimerMode.INTERVAL,
        phase: TimerPhase.WORK,
        phaseDurationMs: 60_000,
        targetTimestampMs: 1_700_000_060_000,
        totalRounds: 5,
      });

      await driver.pause("00:35", 25_000);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: "Round 1/5 | WORK (00:25)",
          isPaused: true,
          subtitle: "Interval. Paused at 00:35",
          targetTimestampMs: 0,
          useChronometer: false,
        })
      );
    });
  });

  describe("IosNoopLiveActivityDriver", () => {
    it("reports live updates as unsupported", async () => {
      const driver = new IosNoopLiveActivityDriver();
      await expect(driver.areLiveUpdatesSupported()).resolves.toBe(false);
    });

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
