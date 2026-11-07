import type {
  ActiveSessionPayload,
  LiveActivityDriver,
} from "@/helpers/background/live-activity-driver";
import type { TimerController } from "@/helpers/timer/controller";

/**
 * Platform-agnostic stub driver for iOS and non-Android environments.
 * Provides clean pass-through methods ready for future ActivityKit implementation.
 */
// oxlint-disable eslint/class-methods-use-this
export class IosNoopLiveActivityDriver implements LiveActivityDriver {
  public readonly isSupported = false;

  public start(_session: ActiveSessionPayload): Promise<void> {
    return Promise.resolve();
  }

  public update(_session: ActiveSessionPayload): Promise<void> {
    return Promise.resolve();
  }

  public pause(_elapsedDisplayTime: string): Promise<void> {
    return Promise.resolve();
  }

  public resume(_session: ActiveSessionPayload): Promise<void> {
    return Promise.resolve();
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

  public attachController(_controller: TimerController): () => void {
    return () => {
      // No-op for iOS stub
    };
  }

  public getMilestoneBridge(): null {
    return null;
  }

  public hasNotificationPermission(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public areLiveUpdatesSupported(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
