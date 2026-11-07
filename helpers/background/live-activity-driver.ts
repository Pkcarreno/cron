import { Platform } from "react-native";

import type { TimerController } from "@/helpers/timer/controller";
import { TimerMode } from "@/helpers/timer/factory";
import type { NativeMilestoneBridge } from "@/helpers/timer/milestone-scheduler";
import { TimerPhase } from "@/helpers/timer/strategy";
import {
  addMilestoneListener,
  addNotificationActionListener,
  areLiveUpdatesSupported,
  clearNativeMilestones,
  hasNotificationPermission,
  scheduleNativeMilestones,
  startForegroundService,
  stopForegroundService,
  updateForegroundService,
} from "@/modules/cron-foreground-service";
import type { ForegroundNotificationPayload } from "@/modules/cron-foreground-service/index";

import { IosNoopLiveActivityDriver } from "./ios-noop-driver";

/**
 * Platform-agnostic state payload dispatched to active background session drivers.
 */
export interface ActiveSessionPayload {
  mode: TimerMode;
  phase: TimerPhase;
  currentRound: number;
  totalRounds: number;
  phaseDurationMs: number;
  targetTimestampMs: number;
  isPaused: boolean;
  isCountDown?: boolean;
  subText?: string;
  headline?: string;
  subtitle?: string;
  accentColor?: string;
  secondaryActionLabel?: string;
  nextPhase?: TimerPhase;
  nextPhaseDurationMs?: number;
  displayTimeMs?: number;
  capDurationMs?: number;
}

/**
 * Presenter interface decoupling the workout session state from platform-specific
 * background display channels (Android Foreground Service, iOS ActivityKit).
 */
export interface LiveActivityDriver {
  start: (session: ActiveSessionPayload) => Promise<void>;
  update: (session: ActiveSessionPayload) => Promise<void>;
  pause: (
    elapsedDisplayTime: string,
    remainingDisplayTimeMs?: number
  ) => Promise<void>;
  resume: (session: ActiveSessionPayload) => Promise<void>;
  stop: () => Promise<void>;
  attachController?: (controller: TimerController) => () => void;
  getMilestoneBridge?: () => NativeMilestoneBridge | null;
  hasNotificationPermission?: () => Promise<boolean>;
  areLiveUpdatesSupported?: () => Promise<boolean>;
  setSupportsLiveUpdates?: (supported: boolean) => void;
  getSupportsLiveUpdates?: () => boolean;
}

/**
 * Formats a duration in milliseconds to clock time (MM:SS or HH:MM:SS),
 * optionally using a single digit for minutes < 10 for compact horizontal chips.
 */
export const formatClockDuration = (ms: number, isCompact = false): string => {
  if (ms <= 0) {
    return isCompact ? "0:00" : "00:00";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = seconds.toString().padStart(2, "0");

  if (hours > 0) {
    const paddedMinutes = minutes.toString().padStart(2, "0");
    const formattedHours = hours.toString().padStart(2, "0");
    return `${formattedHours}:${paddedMinutes}:${paddedSeconds}`;
  }

  const formattedMinutes = isCompact
    ? minutes.toString()
    : minutes.toString().padStart(2, "0");

  return `${formattedMinutes}:${paddedSeconds}`;
};

export interface NotificationContextPayload {
  mode: TimerMode;
  phase: TimerPhase;
  currentRound: number;
  totalRounds: number;
  phaseDurationMs?: number;
  capDurationMs?: number;
  displayTimeMs?: number;
}

const formatSessionContext = (
  payload: NotificationContextPayload,
  isCompact: boolean
): string => {
  if (payload.phase === TimerPhase.PREPARATION) {
    return isCompact ? "PREP" : "PREPARATION";
  }

  switch (payload.mode) {
    case TimerMode.INTERVAL:
    case TimerMode.EMOM: {
      const roundLabel = isCompact
        ? `${payload.currentRound}`
        : `Round ${payload.currentRound}/${payload.totalRounds}`;
      return `${roundLabel} | ${payload.phase}`;
    }
    case TimerMode.AMRAP: {
      const activeRound = Math.max(1, payload.currentRound);
      const roundLabel = isCompact ? `${activeRound}` : `Round ${activeRound}`;
      return `${roundLabel} | WORK`;
    }
    case TimerMode.FOR_TIME: {
      return "WORK";
    }
    case TimerMode.STOP_WATCH: {
      if (payload.currentRound > 1) {
        const lapLabel = isCompact
          ? `${payload.currentRound}`
          : `Lap ${payload.currentRound}`;
        return `${lapLabel} | STOPWATCH`;
      }
      return "STOPWATCH";
    }
    default: {
      return payload.phase;
    }
  }
};

/**
 * Formats the primary notification headline according to the active workout mode.
 * Enforces standard pipe separators without em-dashes and formats durations as MM:SS.
 */
export const formatHeadline = (payload: NotificationContextPayload): string =>
  formatSessionContext(payload, false);

/**
 * Formats a standard Material 3 notification card headline with static text
 * (phase name, round, and remaining duration) for Tier 2 fallback when Live Updates
 * (status bar chips / rich ongoing notifications) are unsupported or disabled.
 */
export const formatTier2Headline = (
  payload: NotificationContextPayload
): string => {
  const baseHeadline = formatHeadline(payload);
  const remainingMs = payload.displayTimeMs ?? payload.phaseDurationMs ?? 0;
  const durationText = formatClockDuration(remainingMs);
  return `${baseHeadline} (${durationText})`;
};

/**
 * Formats the compact chip badge using single-digit values when applicable.
 */
export const formatChip = (payload: NotificationContextPayload): string =>
  formatSessionContext(payload, true);

/**
 * Returns the standardized mode prefix for the subtitle.
 */
export const formatModePrefix = (mode: TimerMode): string => {
  switch (mode) {
    case TimerMode.INTERVAL: {
      return "Interval. ";
    }
    case TimerMode.EMOM: {
      return "EMOM. ";
    }
    case TimerMode.AMRAP: {
      return "AMRAP. ";
    }
    case TimerMode.FOR_TIME: {
      return "For Time. ";
    }
    case TimerMode.STOP_WATCH: {
      return "Stopwatch. ";
    }
    default: {
      return "";
    }
  }
};

/**
 * Formats the notification subtitle with immediate next phase or pause context.
 */
export const formatSubtitle = (options: {
  mode?: TimerMode;
  isPaused?: boolean;
  pausedElapsedDisplayTime?: string;
  nextPhase?: TimerPhase | null;
  nextPhaseDurationMs?: number | null;
  capDurationMs?: number | null;
}): string => {
  const prefix = options.mode ? formatModePrefix(options.mode) : "";

  if (options.isPaused && options.pausedElapsedDisplayTime) {
    return `${prefix}Paused at ${options.pausedElapsedDisplayTime}`;
  }

  if (
    options.nextPhase &&
    options.nextPhaseDurationMs !== null &&
    options.nextPhaseDurationMs !== undefined &&
    options.nextPhaseDurationMs > 0
  ) {
    const duration = formatClockDuration(options.nextPhaseDurationMs);
    return `${prefix}Next: ${options.nextPhase} (${duration})`;
  }

  if (options.capDurationMs && options.capDurationMs > 0) {
    const duration = formatClockDuration(options.capDurationMs);
    return `${prefix}Cap: ${duration}`;
  }

  return prefix.trimEnd();
};

/**
 * Maps the active timer phase to its corresponding theme hex accent color.
 */
export const getPhaseAccentColor = (phase: TimerPhase): string => {
  switch (phase) {
    case TimerPhase.WORK: {
      return "#008153";
    }
    case TimerPhase.REST:
    case TimerPhase.PREPARATION: {
      return "#E7801F";
    }
    default: {
      return "#008153";
    }
  }
};

/**
 * Determines the contextual secondary action label for checkpoint-based modes.
 */
export const getSecondaryActionLabel = (
  mode: TimerMode
): string | undefined => {
  switch (mode) {
    case TimerMode.AMRAP: {
      return "Record Round";
    }
    case TimerMode.STOP_WATCH: {
      return "Lap";
    }
    default: {
      return undefined;
    }
  }
};

export interface AndroidForegroundDriverOptions {
  supportsLiveUpdates?: boolean;
}

const resolveForegroundNotificationPayload = (
  session: ActiveSessionPayload,
  supportsLiveUpdates = true
): ForegroundNotificationPayload => {
  const headline =
    session.headline ??
    (supportsLiveUpdates
      ? formatHeadline(session)
      : formatTier2Headline(session));
  const { subText } = session;
  const subtitle =
    session.subtitle ??
    formatSubtitle({
      capDurationMs: session.capDurationMs,
      isPaused: session.isPaused,
      mode: session.mode,
      nextPhase: session.nextPhase,
      nextPhaseDurationMs: session.nextPhaseDurationMs,
    });
  const color = session.accentColor ?? getPhaseAccentColor(session.phase);
  const secondaryLabel =
    session.phase === TimerPhase.PREPARATION
      ? undefined
      : (session.secondaryActionLabel ?? getSecondaryActionLabel(session.mode));

  return {
    color,
    headline,
    isCountDown: supportsLiveUpdates ? session.isCountDown : false,
    isPaused: session.isPaused,
    secondaryLabel,
    subText,
    subtitle,
    supportsLiveUpdates,
    targetTimestampMs: supportsLiveUpdates ? session.targetTimestampMs : 0,
  };
};

/**
 * Android Foreground Service live activity driver.
 */
// oxlint-disable eslint/class-methods-use-this
export class AndroidForegroundDriver implements LiveActivityDriver {
  private lastSessionPayload: ActiveSessionPayload | null = null;
  private isServiceActive = false;
  private controllerSubscription: { remove: () => void } | null = null;
  private supportsLiveUpdates = true;
  private hasExplicitSupportsLiveUpdates = false;

  constructor(options?: AndroidForegroundDriverOptions) {
    if (options?.supportsLiveUpdates !== undefined) {
      this.supportsLiveUpdates = options.supportsLiveUpdates;
      this.hasExplicitSupportsLiveUpdates = true;
    }
  }

  public setSupportsLiveUpdates(supported: boolean): void {
    this.supportsLiveUpdates = supported;
    this.hasExplicitSupportsLiveUpdates = true;
  }

  public getSupportsLiveUpdates(): boolean {
    return this.supportsLiveUpdates;
  }

  public async areLiveUpdatesSupported(): Promise<boolean> {
    if (this.hasExplicitSupportsLiveUpdates) {
      return this.supportsLiveUpdates;
    }
    const supported = await areLiveUpdatesSupported();
    this.supportsLiveUpdates = supported;
    return supported;
  }

  public async start(session: ActiveSessionPayload): Promise<void> {
    this.lastSessionPayload = session;
    this.isServiceActive = true;
    await startForegroundService(
      resolveForegroundNotificationPayload(session, this.supportsLiveUpdates)
    );
  }

  public async update(session: ActiveSessionPayload): Promise<void> {
    this.lastSessionPayload = session;

    if (!this.isServiceActive) {
      return this.start(session);
    }

    await updateForegroundService(
      resolveForegroundNotificationPayload(session, this.supportsLiveUpdates)
    );
  }

  public async pause(
    elapsedDisplayTime: string,
    remainingDisplayTimeMs?: number
  ): Promise<void> {
    if (!this.lastSessionPayload) {
      return;
    }

    const pausedSubtitle = formatSubtitle({
      isPaused: true,
      mode: this.lastSessionPayload.mode,
      pausedElapsedDisplayTime: elapsedDisplayTime,
    });

    const pausedSession: ActiveSessionPayload = {
      ...this.lastSessionPayload,
      displayTimeMs:
        remainingDisplayTimeMs ?? this.lastSessionPayload.displayTimeMs,
      isPaused: true,
      subtitle: pausedSubtitle,
      targetTimestampMs: 0,
    };

    await this.update(pausedSession);
  }

  public async resume(session: ActiveSessionPayload): Promise<void> {
    await this.update({
      ...session,
      isPaused: false,
    });
  }

  public async stop(): Promise<void> {
    this.isServiceActive = false;
    this.lastSessionPayload = null;
    await stopForegroundService();
  }

  public attachController(controller: TimerController): () => void {
    this.controllerSubscription?.remove();
    this.controllerSubscription = addNotificationActionListener((event) => {
      switch (event.action) {
        case "pause": {
          controller.pause();
          break;
        }
        case "resume": {
          controller.start();
          break;
        }
        case "checkpoint": {
          controller.recordCheckpoint();
          break;
        }
        default: {
          break;
        }
      }
    });

    return () => {
      this.controllerSubscription?.remove();
      this.controllerSubscription = null;
    };
  }

  public getIsActive(): boolean {
    return this.isServiceActive;
  }

  public getLastPayload(): ActiveSessionPayload | null {
    return this.lastSessionPayload;
  }

  public getMilestoneBridge(): NativeMilestoneBridge {
    return {
      addMilestoneListener,
      clearMilestones: clearNativeMilestones,
      scheduleMilestones: scheduleNativeMilestones,
    };
  }

  public async hasNotificationPermission(): Promise<boolean> {
    return await hasNotificationPermission();
  }
}

/**
 * Creates the appropriate LiveActivityDriver implementation for the current platform.
 */
export const createLiveActivityDriver = (
  platform: string = Platform.OS,
  options?: AndroidForegroundDriverOptions
): LiveActivityDriver => {
  if (platform === "android") {
    return new AndroidForegroundDriver(options);
  }
  return new IosNoopLiveActivityDriver();
};
