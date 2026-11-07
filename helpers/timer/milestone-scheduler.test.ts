import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import {
  AUDIO_WARMUP_LEAD_TIME_MS,
  calculatePhaseMilestones,
  MilestoneScheduler,
} from "@/helpers/timer/milestone-scheduler";
import type {
  NativeMilestoneBridge,
  NativeMilestoneEvent,
} from "@/helpers/timer/milestone-scheduler";

describe("milestoneScheduler", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 1, 1, 0, 0, 0));
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe("calculatePhaseMilestones", () => {
    it("calculates exact target timestamps for warmup, countdown beeps, and transition", () => {
      const now = 10_000;
      const phaseDurationMs = 20_000;
      const phaseRemainingMs = 20_000;

      const milestones = calculatePhaseMilestones({
        hasCountdownBeeps: true,
        now,
        phaseDurationMs,
        phaseRemainingMs,
      });

      // Target timestamp is now + remaining
      expect(milestones.targetTimestampMs).toBe(30_000);
      expect(milestones.transitionTimestampMs).toBe(30_000);

      // Countdown beeps at T - 3000ms, T - 2000ms, T - 1000ms
      expect(milestones.countdownBeeps).toEqual([
        {
          delayMs: 17_000,
          secondRemaining: 3,
          targetTimestampMs: 27_000,
        },
        {
          delayMs: 18_000,
          secondRemaining: 2,
          targetTimestampMs: 28_000,
        },
        {
          delayMs: 19_000,
          secondRemaining: 1,
          targetTimestampMs: 29_000,
        },
      ]);

      // Audio DAC pre-warms ~1500 ms before countdown beeps trigger (30000 - 3000 - 1500 = 25500)
      expect(milestones.warmupTimestampMs).toBe(25_500);
      expect(milestones.warmupDelayMs).toBe(15_500);
      expect(
        milestones.countdownBeeps[0].targetTimestampMs -
          milestones.warmupTimestampMs
      ).toBe(AUDIO_WARMUP_LEAD_TIME_MS);
    });

    it("pre-warms ~1500 ms before transition when countdown beeps are not configured", () => {
      const now = 0;
      const phaseDurationMs = 10_000;
      const phaseRemainingMs = 10_000;

      const milestones = calculatePhaseMilestones({
        hasCountdownBeeps: false,
        now,
        phaseDurationMs,
        phaseRemainingMs,
      });

      expect(milestones.targetTimestampMs).toBe(10_000);
      expect(milestones.countdownBeeps).toEqual([]);
      // Warmup at target - 1500ms
      expect(milestones.warmupTimestampMs).toBe(8500);
      expect(milestones.warmupDelayMs).toBe(8500);
    });

    it("clamps warmup delay to 0 when remaining time is already inside the warmup window", () => {
      const now = 1000;
      const phaseDurationMs = 5000;
      // Only 2.5s left (warmup at -4500ms is in the past)
      const phaseRemainingMs = 2500;

      const milestones = calculatePhaseMilestones({
        hasCountdownBeeps: true,
        now,
        phaseDurationMs,
        phaseRemainingMs,
      });

      expect(milestones.targetTimestampMs).toBe(3500);
      expect(milestones.warmupDelayMs).toBe(0);

      // Beep 3 is in the past (3500 - 3000 = 500 < now: 1000), only beeps 2 and 1 remain
      expect(milestones.countdownBeeps).toEqual([
        {
          delayMs: 500,
          secondRemaining: 2,
          targetTimestampMs: 1500,
        },
        {
          delayMs: 1500,
          secondRemaining: 1,
          targetTimestampMs: 2500,
        },
      ]);
    });

    it("handles short phases (< 3000ms) with no countdown beeps", () => {
      const now = 0;
      const phaseDurationMs = 2000;
      const phaseRemainingMs = 2000;

      const milestones = calculatePhaseMilestones({
        now,
        phaseDurationMs,
        phaseRemainingMs,
      });

      expect(milestones.targetTimestampMs).toBe(2000);
      expect(milestones.countdownBeeps).toEqual([]);
      // Warmup at 2000 - 1500 = 500ms
      expect(milestones.warmupTimestampMs).toBe(500);
      expect(milestones.warmupDelayMs).toBe(500);
    });
  });

  describe("MilestoneScheduler execution", () => {
    it("dispatches warmup, countdown beeps, and transition single-shot timers accurately", () => {
      const onWarmup = jest.fn();
      const onCountdownBeep = jest.fn();
      const onTransition = jest.fn();

      const scheduler = new MilestoneScheduler({
        onCountdownBeep,
        onTransition,
        onWarmup,
      });

      const now = 0;
      const milestones = calculatePhaseMilestones({
        hasCountdownBeeps: true,
        now,
        phaseDurationMs: 10_000,
        phaseRemainingMs: 10_000,
      });

      scheduler.scheduleMilestones(milestones, now);

      // 5 single-shot timers scheduled (warmup, 3 beeps, transition) without polling
      expect(scheduler.getScheduledTimeoutCount()).toBe(5);

      // Advance to warmup (at 10000 - 4500 = 5500ms)
      jest.advanceTimersByTime(5500);
      expect(onWarmup).toHaveBeenCalledTimes(1);
      expect(onCountdownBeep).not.toHaveBeenCalled();
      expect(onTransition).not.toHaveBeenCalled();

      // Advance to beep 3 (at 7000ms -> +1500ms)
      jest.advanceTimersByTime(1500);
      expect(onCountdownBeep).toHaveBeenCalledWith(3);

      // Advance to beep 2 (at 8000ms -> +1000ms)
      jest.advanceTimersByTime(1000);
      expect(onCountdownBeep).toHaveBeenCalledWith(2);

      // Advance to beep 1 (at 9000ms -> +1000ms)
      jest.advanceTimersByTime(1000);
      expect(onCountdownBeep).toHaveBeenCalledWith(1);

      // Advance to transition (at 10000ms -> +1000ms)
      jest.advanceTimersByTime(1000);
      expect(onTransition).toHaveBeenCalledTimes(1);
      expect(scheduler.getActiveMilestones()).toBeNull();
    });

    it("cancels all pending timeouts on clearMilestones without firing callbacks", () => {
      const onWarmup = jest.fn();
      const onCountdownBeep = jest.fn();
      const onTransition = jest.fn();

      const scheduler = new MilestoneScheduler({
        onCountdownBeep,
        onTransition,
        onWarmup,
      });

      const milestones = calculatePhaseMilestones({
        hasCountdownBeeps: true,
        now: 0,
        phaseDurationMs: 10_000,
        phaseRemainingMs: 10_000,
      });

      scheduler.scheduleMilestones(milestones, 0);
      expect(scheduler.getScheduledTimeoutCount()).toBe(5);

      scheduler.clearMilestones();
      expect(scheduler.getScheduledTimeoutCount()).toBe(0);
      expect(scheduler.getActiveMilestones()).toBeNull();

      jest.advanceTimersByTime(20_000);
      expect(onWarmup).not.toHaveBeenCalled();
      expect(onCountdownBeep).not.toHaveBeenCalled();
      expect(onTransition).not.toHaveBeenCalled();
    });

    it("handles native milestones and deduplicates against JS timeouts", () => {
      let triggerNativeMilestone!: (event: NativeMilestoneEvent) => void;

      const mockBridge: NativeMilestoneBridge = {
        addMilestoneListener: jest.fn(
          (listener: (event: NativeMilestoneEvent) => void) => {
            triggerNativeMilestone = listener;
            return { remove: jest.fn() };
          }
        ),
        clearMilestones: jest
          .fn<() => Promise<boolean>>()
          .mockResolvedValue(true),
        scheduleMilestones: jest
          .fn<() => Promise<boolean>>()
          .mockResolvedValue(true),
      };

      const onWarmup = jest.fn();
      const onCountdownBeep = jest.fn();
      const onTransition = jest.fn();

      const scheduler = new MilestoneScheduler(
        {
          onCountdownBeep,
          onTransition,
          onWarmup,
        },
        mockBridge
      );

      const milestones = calculatePhaseMilestones({
        hasCountdownBeeps: true,
        now: 0,
        phaseDurationMs: 10_000,
        phaseRemainingMs: 10_000,
      });

      scheduler.scheduleMilestones(milestones, 0);

      // Trigger native warmup
      triggerNativeMilestone({ type: "warmup" });
      expect(onWarmup).toHaveBeenCalledTimes(1);

      // Advance timers past warmup delay - should not double trigger warmup
      jest.advanceTimersByTime(6000);
      expect(onWarmup).toHaveBeenCalledTimes(1);

      // Trigger native beep 3
      triggerNativeMilestone({ secondRemaining: 3, type: "beep" });
      expect(onCountdownBeep).toHaveBeenCalledWith(3);

      // Advance timers past beep 3 (7000ms) but before beep 2 (8000ms) - should not double trigger beep 3
      jest.advanceTimersByTime(1500);
      expect(onCountdownBeep).toHaveBeenCalledTimes(1);

      // Trigger native transition
      triggerNativeMilestone({ type: "transition" });
      expect(onTransition).toHaveBeenCalledTimes(1);

      // Advance timers to transition - should not double trigger transition
      jest.advanceTimersByTime(5000);
      expect(onTransition).toHaveBeenCalledTimes(1);

      scheduler.dispose();
    });
  });
});
