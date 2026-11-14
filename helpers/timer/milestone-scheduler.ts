/**
 * Constants governing deterministic target-based milestone scheduling.
 * ADR 0010: Prewarm wakes DAC ~1500 ms before cues; Countdown window spans 3000 ms.
 */
export const AUDIO_WARMUP_LEAD_TIME_MS = 1000;
export const AUDIO_DUCKING_LEAD_TIME_MS = 150;
export const COUNTDOWN_WINDOW_MS = 3000;

export interface CountdownBeepMilestoneItem {
  delayMs: number;
  secondRemaining: number;
  targetTimestampMs: number;
}

export interface PhaseMilestones {
  countdownBeeps: CountdownBeepMilestoneItem[];
  duckingDelayMs: number;
  duckingTimestampMs: number;
  phaseDurationMs: number;
  phaseRemainingMs: number;
  targetTimestampMs: number;
  transitionTimestampMs: number;
  warmupDelayMs: number;
  warmupTimestampMs: number;
}

export interface CalculatePhaseMilestonesOptions {
  hasCountdownBeeps?: boolean;
  now?: number;
  phaseDurationMs: number;
  phaseRemainingMs: number;
}

export interface NativeMilestoneScheduleItem {
  delayMs: number;
  secondRemaining: number;
}

export interface NativeMilestoneSchedulePayload {
  countdownBeeps?: NativeMilestoneScheduleItem[];
  duckingDelayMs?: number;
  transitionDelayMs: number;
  warmupDelayMs?: number;
}

export interface NativeMilestoneEvent {
  type: "warmup" | "ducking" | "beep" | "transition";
  secondRemaining?: number;
}

/**
 * Platform bridge interface decoupling native hardware scheduling from core timer domain.
 */
export interface NativeMilestoneBridge {
  scheduleMilestones: (
    payload: NativeMilestoneSchedulePayload
  ) => Promise<unknown>;
  clearMilestones: () => Promise<unknown>;
  addMilestoneListener: (listener: (event: NativeMilestoneEvent) => void) => {
    remove: () => void;
  };
}

/**
 * Pure calculation function projecting wall-clock target timestamps for upcoming milestones.
 * Eliminates 1 Hz polling jitter by scheduling single-shot hardware/clock timers.
 */
export const calculatePhaseMilestones = (
  options: CalculatePhaseMilestonesOptions
): PhaseMilestones => {
  const now = options.now ?? Date.now();
  const targetTimestampMs = now + options.phaseRemainingMs;
  const transitionTimestampMs = targetTimestampMs;

  const hasCountdownBeeps =
    options.hasCountdownBeeps ?? options.phaseDurationMs >= COUNTDOWN_WINDOW_MS;

  const countdownBeeps: CountdownBeepMilestoneItem[] = [];
  const phaseStartTimestampMs = targetTimestampMs - options.phaseDurationMs;

  if (hasCountdownBeeps) {
    for (const second of [3, 2, 1]) {
      const beepTargetTimestampMs = targetTimestampMs - second * 1000;
      if (
        beepTargetTimestampMs >= phaseStartTimestampMs &&
        beepTargetTimestampMs > now
      ) {
        countdownBeeps.push({
          delayMs: Math.max(0, beepTargetTimestampMs - now),
          secondRemaining: second,
          targetTimestampMs: beepTargetTimestampMs,
        });
      }
    }
  }

  // Prewarm & Ducking milestones:
  // If countdown beeps are configured, pre-warms ~1000 ms and ducks ~150 ms before countdown beeps trigger
  // (target - 3000 ms - leadTime) preventing cold-start clipping and providing acoustic lead-in.
  // If no countdown beeps, pre-warms ~1000 ms and ducks ~150 ms before the transition cue (target - leadTime).
  const theoreticalCountdownStartMs = targetTimestampMs - COUNTDOWN_WINDOW_MS;
  const firstAudioTargetMs = hasCountdownBeeps
    ? theoreticalCountdownStartMs
    : targetTimestampMs;

  const warmupTimestampMs = firstAudioTargetMs - AUDIO_WARMUP_LEAD_TIME_MS;
  const duckingTimestampMs = firstAudioTargetMs - AUDIO_DUCKING_LEAD_TIME_MS;

  const warmupDelayMs = Math.max(0, warmupTimestampMs - now);
  const duckingDelayMs = Math.max(0, duckingTimestampMs - now);

  return {
    countdownBeeps,
    duckingDelayMs,
    duckingTimestampMs,
    phaseDurationMs: options.phaseDurationMs,
    phaseRemainingMs: options.phaseRemainingMs,
    targetTimestampMs,
    transitionTimestampMs,
    warmupDelayMs,
    warmupTimestampMs,
  };
};

export interface MilestoneSchedulerCallbacks {
  onCountdownBeep: (secondRemaining: number) => void;
  onDucking?: () => void;
  onTransition: () => void;
  onWarmup: () => void;
}

/**
 * Deterministic milestone scheduler managing wall-clock single-shot timers
 * when high-frequency UI rendering loops are suspended in the background.
 * Optionally bridges to a platform-native milestone driver to bypass JS timer freeze.
 */
export class MilestoneScheduler {
  private callbacks: MilestoneSchedulerCallbacks;
  private bridge: NativeMilestoneBridge | null = null;
  private activeMilestones: PhaseMilestones | null = null;
  private activeTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private milestoneSubscription: { remove: () => void } | null = null;

  private triggeredBeeps = new Set<number>();
  private hasTriggeredWarmup = false;
  private hasTriggeredDucking = false;
  private hasTriggeredTransition = false;

  constructor(
    callbacks: MilestoneSchedulerCallbacks,
    bridge?: NativeMilestoneBridge | null
  ) {
    this.callbacks = callbacks;
    if (bridge) {
      this.setBridge(bridge);
    }
  }

  public setBridge(bridge: NativeMilestoneBridge | null): void {
    this.milestoneSubscription?.remove();
    this.milestoneSubscription = null;
    this.bridge = bridge;

    if (bridge) {
      this.milestoneSubscription = bridge.addMilestoneListener((event) => {
        this.handleNativeMilestone(event);
      });
    }
  }

  private handleNativeMilestone(event: NativeMilestoneEvent): void {
    if (!this.activeMilestones) {
      return;
    }

    switch (event.type) {
      case "warmup": {
        if (!this.hasTriggeredWarmup) {
          this.hasTriggeredWarmup = true;
          this.callbacks.onWarmup();
        }
        break;
      }
      case "ducking": {
        if (!this.hasTriggeredDucking) {
          this.hasTriggeredDucking = true;
          this.callbacks.onDucking?.();
        }
        break;
      }
      case "beep": {
        const second = event.secondRemaining ?? 0;
        if (!this.triggeredBeeps.has(second)) {
          this.triggeredBeeps.add(second);
          this.callbacks.onCountdownBeep(second);
        }
        break;
      }
      case "transition": {
        if (!this.hasTriggeredTransition) {
          this.hasTriggeredTransition = true;
          this.clearMilestones();
          this.callbacks.onTransition();
        }
        break;
      }
      default: {
        break;
      }
    }
  }

  public getActiveMilestones(): PhaseMilestones | null {
    return this.activeMilestones;
  }

  public getScheduledTimeoutCount(): number {
    return this.activeTimeouts.size;
  }

  public scheduleMilestones(
    milestones: PhaseMilestones,
    now: number = Date.now()
  ): void {
    this.clearMilestones();
    this.activeMilestones = milestones;
    this.triggeredBeeps.clear();
    this.hasTriggeredWarmup = false;
    this.hasTriggeredDucking = false;
    this.hasTriggeredTransition = false;

    // 1. Dispatch native background scheduling if bridge is configured (e.g. Android Handler loop)
    if (this.bridge) {
      void this.bridge.scheduleMilestones({
        countdownBeeps: milestones.countdownBeeps.map((beep) => ({
          delayMs: Math.max(0, beep.targetTimestampMs - now),
          secondRemaining: beep.secondRemaining,
        })),
        duckingDelayMs: Math.max(0, milestones.duckingTimestampMs - now),
        transitionDelayMs: Math.max(0, milestones.transitionTimestampMs - now),
        warmupDelayMs: Math.max(0, milestones.warmupTimestampMs - now),
      });
    }

    // 2. Schedule JS timeouts (drives foreground execution, iOS, Web, and Jest)
    // 2.1 Warmup timer
    if (now < milestones.transitionTimestampMs) {
      const warmupDelay = Math.max(0, milestones.warmupTimestampMs - now);
      const timerId = setTimeout(() => {
        this.activeTimeouts.delete(timerId);
        if (!this.hasTriggeredWarmup) {
          this.hasTriggeredWarmup = true;
          this.callbacks.onWarmup();
        }
      }, warmupDelay);
      this.activeTimeouts.add(timerId);
    }

    // 2.2 Ducking timer
    if (now < milestones.transitionTimestampMs && this.callbacks.onDucking) {
      const duckingDelay = Math.max(0, milestones.duckingTimestampMs - now);
      const timerId = setTimeout(() => {
        this.activeTimeouts.delete(timerId);
        if (!this.hasTriggeredDucking) {
          this.hasTriggeredDucking = true;
          this.callbacks.onDucking?.();
        }
      }, duckingDelay);
      this.activeTimeouts.add(timerId);
    }

    // 2.3 Countdown beep timers
    for (const beep of milestones.countdownBeeps) {
      const beepDelay = Math.max(0, beep.targetTimestampMs - now);
      const timerId = setTimeout(() => {
        this.activeTimeouts.delete(timerId);
        if (!this.triggeredBeeps.has(beep.secondRemaining)) {
          this.triggeredBeeps.add(beep.secondRemaining);
          this.callbacks.onCountdownBeep(beep.secondRemaining);
        }
      }, beepDelay);
      this.activeTimeouts.add(timerId);
    }

    // 2.4 Transition timer
    const transitionDelay = Math.max(0, milestones.transitionTimestampMs - now);
    const timerId = setTimeout(() => {
      this.activeTimeouts.delete(timerId);
      if (!this.hasTriggeredTransition) {
        this.hasTriggeredTransition = true;
        this.clearMilestones();
        this.callbacks.onTransition();
      }
    }, transitionDelay);
    this.activeTimeouts.add(timerId);
  }

  public clearMilestones(): void {
    for (const timeoutId of this.activeTimeouts) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
    this.activeMilestones = null;
    if (this.bridge) {
      void this.bridge.clearMilestones();
    }
  }

  public dispose(): void {
    this.clearMilestones();
    this.milestoneSubscription?.remove();
    this.milestoneSubscription = null;
    this.bridge = null;
  }
}
