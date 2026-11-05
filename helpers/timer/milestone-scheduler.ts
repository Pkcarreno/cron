/**
 * Constants governing deterministic target-based milestone scheduling.
 * ADR 0010: Prewarm wakes DAC ~1500 ms before cues; Countdown window spans 3000 ms.
 */
export const AUDIO_WARMUP_LEAD_TIME_MS = 1500;
export const COUNTDOWN_WINDOW_MS = 3000;

export interface CountdownBeepMilestoneItem {
  delayMs: number;
  secondRemaining: number;
  targetTimestampMs: number;
}

export interface PhaseMilestones {
  countdownBeeps: CountdownBeepMilestoneItem[];
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

  // Prewarm milestone:
  // If countdown beeps are configured, pre-warms ~1500 ms before countdown beeps trigger (target - 4500 ms)
  // preventing cold-start clipping on the first beep.
  // If no countdown beeps, pre-warms ~1500 ms before the transition cue (target - 1500 ms).
  const theoreticalCountdownStartMs = targetTimestampMs - COUNTDOWN_WINDOW_MS;
  const warmupTimestampMs = hasCountdownBeeps
    ? theoreticalCountdownStartMs - AUDIO_WARMUP_LEAD_TIME_MS
    : targetTimestampMs - AUDIO_WARMUP_LEAD_TIME_MS;

  const warmupDelayMs = Math.max(0, warmupTimestampMs - now);

  return {
    countdownBeeps,
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
  onTransition: () => void;
  onWarmup: () => void;
}

/**
 * Deterministic milestone scheduler managing wall-clock single-shot timers
 * when high-frequency UI rendering loops are suspended in the background.
 */
export class MilestoneScheduler {
  private callbacks: MilestoneSchedulerCallbacks;
  private activeMilestones: PhaseMilestones | null = null;
  private activeTimeouts = new Set<ReturnType<typeof setTimeout>>();

  constructor(callbacks: MilestoneSchedulerCallbacks) {
    this.callbacks = callbacks;
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

    // 1. Warmup timer
    if (now < milestones.transitionTimestampMs) {
      const warmupDelay = Math.max(0, milestones.warmupTimestampMs - now);
      const timerId = setTimeout(() => {
        this.activeTimeouts.delete(timerId);
        this.callbacks.onWarmup();
      }, warmupDelay);
      this.activeTimeouts.add(timerId);
    }

    // 2. Countdown beep timers
    for (const beep of milestones.countdownBeeps) {
      const beepDelay = Math.max(0, beep.targetTimestampMs - now);
      const timerId = setTimeout(() => {
        this.activeTimeouts.delete(timerId);
        this.callbacks.onCountdownBeep(beep.secondRemaining);
      }, beepDelay);
      this.activeTimeouts.add(timerId);
    }

    // 3. Transition timer
    const transitionDelay = Math.max(0, milestones.transitionTimestampMs - now);
    const timerId = setTimeout(() => {
      this.activeTimeouts.delete(timerId);
      this.activeMilestones = null;
      this.callbacks.onTransition();
    }, transitionDelay);
    this.activeTimeouts.add(timerId);
  }

  public clearMilestones(): void {
    for (const timeoutId of this.activeTimeouts) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
    this.activeMilestones = null;
  }

  public dispose(): void {
    this.clearMilestones();
  }
}
