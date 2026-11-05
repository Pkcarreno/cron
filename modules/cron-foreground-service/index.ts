import type { EventSubscription, NativeModule } from "expo-modules-core";
import { EventEmitter, requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export interface ForegroundNotificationPayload {
  headline?: string;
  subtitle?: string;
  targetTimestampMs?: number;
  isPaused?: boolean;
  color?: string;
  secondaryLabel?: string;
}

export type NotificationActionType = "pause" | "resume" | "checkpoint";

export interface NotificationActionEvent {
  action: NotificationActionType;
}

declare class CronForegroundNativeModule extends NativeModule<{
  onNotificationAction: (event: NotificationActionEvent) => void;
}> {
  start(payload: ForegroundNotificationPayload): Promise<boolean>;
  update(payload: ForegroundNotificationPayload): Promise<boolean>;
  stop(): Promise<boolean>;
  isServiceRunning(): Promise<boolean>;
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

export const startForegroundService = async (
  payload: ForegroundNotificationPayload
): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.start(payload);
};

export const updateForegroundService = async (
  payload: ForegroundNotificationPayload
): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.update(payload);
};

export const stopForegroundService = async (): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.stop();
};

export const isForegroundServiceRunning = async (): Promise<boolean> => {
  const mod = getNativeModule();
  if (!mod) {
    return false;
  }
  return await mod.isServiceRunning();
};

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
