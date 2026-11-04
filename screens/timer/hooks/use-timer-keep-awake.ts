import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";

export const TIMER_KEEP_AWAKE_TAG = "cron-timer";

const enableScreenWakeLock = async (): Promise<void> => {
  try {
    await activateKeepAwakeAsync(TIMER_KEEP_AWAKE_TAG);
  } catch {
    // Silently ignore if WakeLock is unavailable or rejected by the system
  }
};

const releaseScreenWakeLock = async (): Promise<void> => {
  try {
    await deactivateKeepAwake(TIMER_KEEP_AWAKE_TAG);
  } catch {
    // Silently ignore errors during cleanup
  }
};

/**
 * Manages screen sleep prevention for the workout timer session.
 *
 * Prevents OS screen timeout during active training intervals (`TimerStatus.RUNNING`)
 * so athletes maintain distance visibility, while immediately releasing the wake
 * lock on pause or session completion to mitigate OLED diode wear and conserve battery.
 *
 * @param isActive Truthy strictly when the workout session is actively progressing.
 */
export const useTimerKeepAwake = (isActive: boolean): void => {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    void enableScreenWakeLock();

    return () => {
      void releaseScreenWakeLock();
    };
  }, [isActive]);
};
