import type { EventSubscription, NativeModule } from "expo-modules-core";
import { EventEmitter, requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

/**
 * Payload configuration dispatched to the native Android Foreground Service.
 */
export interface ForegroundNotificationPayload {
  /** Main title displayed on the ongoing notification card (e.g., "WORK — Round 3/8"). */
  headline?: string;
  /** Subtitle providing secondary or next phase context (e.g., "Next: REST (30s)"). */
  subtitle?: string;
  /** Target timestamp in epoch milliseconds for hardware chronometer calculations. */
  targetTimestampMs?: number;
  /** Indicates whether workout progression is actively paused. */
  isPaused?: boolean;
  /**
   * Direction of the hardware chronometer: true for countdown (default), false for count-up (Stopwatch).
   */
  isCountDown?: boolean;
  /** Hex color code for tinting the small icon and notification accents (e.g., "#008153"). */
  color?: string;
  /** Contextual secondary action button label (e.g., "Record Round", "Lap"). */
  secondaryLabel?: string;
}

/** Action types emitted when athletes interact with notification action buttons. */
export type NotificationActionType = "pause" | "resume" | "checkpoint";

/** Event payload received when an interactive notification action triggers. */
export interface NotificationActionEvent {
  action: NotificationActionType;
}

/** Configuration payload for deterministic native milestone scheduling. */
export interface ScheduledMilestonesPayload {
  warmupDelayMs?: number;
  countdownBeeps?: {
    delayMs: number;
    secondRemaining: number;
  }[];
  transitionDelayMs: number;
}

/** Types of milestones dispatched by the native Android Handler bridge. */
export type MilestoneType = "warmup" | "beep" | "transition";

/** Event payload emitted when a native milestone timer expires. */
export interface MilestoneEvent {
  type: MilestoneType;
  secondRemaining?: number;
}

declare class CronForegroundNativeModule extends NativeModule<{
  onNotificationAction: (event: NotificationActionEvent) => void;
  onMilestone: (event: MilestoneEvent) => void;
}> {
  start(payload: ForegroundNotificationPayload): Promise<boolean>;
  update(payload: ForegroundNotificationPayload): Promise<boolean>;
  stop(): Promise<boolean>;
  isServiceRunning(): Promise<boolean>;
  scheduleMilestones(payload: ScheduledMilestonesPayload): Promise<boolean>;
  clearMilestones(): Promise<boolean>;
}

let nativeModule: CronForegroundNativeModule | null = null;

export const getNativeModule = (): CronForegroundNativeModule | null => {
  if (Platform.OS !== "android") {
    return null;
  }
  if (!nativeModule) {
    try {
      nativeModule = requireNativeModule<CronForegroundNativeModule>(
        "CronForegroundService"
      );
    } catch {
      nativeModule = null;
    }
  }
  return nativeModule;
};

let emitter: EventEmitter<{
  onNotificationAction: (event: NotificationActionEvent) => void;
  onMilestone: (event: MilestoneEvent) => void;
}> | null = null;

const getEmitter = () => {
  if (!emitter) {
    const mod = getNativeModule();
    if (mod) {
      // eslint-disable-next-line unicorn/prefer-event-target
      emitter = new EventEmitter(mod);
    }
  }
  return emitter;
};

/**
 * Starts the native Android Foreground Service with the given notification payload.
 */
export const startForegroundService = async (
  payload: ForegroundNotificationPayload
): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.start(payload);
};

/**
 * Updates an ongoing notification for the active foreground service.
 */
export const updateForegroundService = async (
  payload: ForegroundNotificationPayload
): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.update(payload);
};

/**
 * Stops the active Android Foreground Service and dismisses the ongoing notification.
 */
export const stopForegroundService = async (): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.stop();
};

/**
 * Checks whether the native Android Foreground Service is currently active.
 */
export const isForegroundServiceRunning = async (): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.isServiceRunning();
};

/**
 * Schedules deterministic native milestones using the Android Handler loop.
 */
export const scheduleNativeMilestones = async (
  payload: ScheduledMilestonesPayload
): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.scheduleMilestones(payload);
};

/**
 * Clears all pending native milestone callbacks from the Android Handler loop.
 */
export const clearNativeMilestones = async (): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.clearMilestones();
};

/**
 * Registers an observer for user clicks on notification action buttons.
 */
export const addNotificationActionListener = (
  listener: (event: NotificationActionEvent) => void
): EventSubscription => {
  const eventEmitter = getEmitter();
  if (!eventEmitter) {
    return {
      remove: () => {
        // No-op when event emitter is unavailable
      },
    };
  }
  return eventEmitter.addListener("onNotificationAction", listener);
};

/**
 * Registers an observer for native milestone bridge events (warmup, beep, transition).
 */
export const addMilestoneListener = (
  listener: (event: MilestoneEvent) => void
): EventSubscription => {
  const eventEmitter = getEmitter();
  if (!eventEmitter) {
    return {
      remove: () => {
        // No-op when event emitter is unavailable
      },
    };
  }
  return eventEmitter.addListener("onMilestone", listener);
};
