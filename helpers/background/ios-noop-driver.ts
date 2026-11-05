import type {
  ActiveSessionPayload,
  LiveActivityDriver,
} from "@/helpers/background/live-activity-driver";
import type { TimerController } from "@/helpers/timer/controller";

export class IosNoopLiveActivityDriver implements LiveActivityDriver {
  public readonly isSupported = false;

  public start(_session: ActiveSessionPayload): Promise<void> {
    if (this.isSupported) {
      // Future ActivityKit integration
    }
    return Promise.resolve();
  }

  public update(_session: ActiveSessionPayload): Promise<void> {
    if (this.isSupported) {
      // Future ActivityKit integration
    }
    return Promise.resolve();
  }

  public pause(_elapsedDisplayTime: string): Promise<void> {
    if (this.isSupported) {
      // Future ActivityKit integration
    }
    return Promise.resolve();
  }

  public resume(_session: ActiveSessionPayload): Promise<void> {
    if (this.isSupported) {
      // Future ActivityKit integration
    }
    return Promise.resolve();
  }

  public stop(): Promise<void> {
    if (this.isSupported) {
      // Future ActivityKit integration
    }
    return Promise.resolve();
  }

  public attachController(_controller: TimerController): () => void {
    if (this.isSupported) {
      // Future ActivityKit integration
    }
    return () => {
      // No-op for iOS stub
    };
  }
}
