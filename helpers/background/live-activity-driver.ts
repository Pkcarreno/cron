import { Platform } from "react-native";

import type { TimerController } from "@/helpers/timer/controller";
import { TimerMode } from "@/helpers/timer/factory";
import { TimerPhase } from "@/helpers/timer/strategy";
import {
  addNotificationActionListener,
  startForegroundService,
  stopForegroundService,
  updateForegroundService,
} from "@/modules/cron-foreground-service";

import { IosNoopLiveActivityDriver } from "./ios-noop-driver";

export { IosNoopLiveActivityDriver } from "./ios-noop-driver";

export interface ActiveSessionPayload {
  mode: TimerMode;
  phase: TimerPhase;
  currentRound: number;
  totalRounds: number;
  phaseDurationMs: number;
  targetTimestampMs: number;
  isPaused: boolean;
  headline?: string;
  subtitle?: string;
  accentColor?: string;
  secondaryActionLabel?: string;
  nextPhase?: TimerPhase;
  nextPhaseDurationMs?: number;
  displayTimeMs?: number;
  capDurationMs?: number;
}

export interface LiveActivityDriver {
  start: (session: ActiveSessionPayload) => Promise<void>;
  update: (session: ActiveSessionPayload) => Promise<void>;
  pause: (elapsedDisplayTime: string) => Promise<void>;
  resume: (session: ActiveSessionPayload) => Promise<void>;
  stop: () => Promise<void>;
  attachController?: (controller: TimerController) => () => void;
}

const formatCapDuration = (capDurationMs: number): string => {
  const totalSeconds = Math.floor(capDurationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const formatHeadline = (payload: {
  mode: TimerMode;
  phase: TimerPhase;
  currentRound: number;
  totalRounds: number;
  capDurationMs?: number;
}): string => {
  if (payload.phase === TimerPhase.PREPARATION) {
    return "PREPARATION";
  }

  switch (payload.mode) {
    case TimerMode.INTERVAL:
    case TimerMode.EMOM: {
      return `${payload.phase} — Round ${payload.currentRound}/${payload.totalRounds}`;
    }
    case TimerMode.AMRAP: {
      const activeRound = Math.max(1, payload.currentRound);
      return `AMRAP — Round ${activeRound}`;
    }
    case TimerMode.STOP_WATCH: {
      const activeLap = Math.max(1, payload.currentRound);
      return `STOPWATCH — Lap ${activeLap}`;
    }
    case TimerMode.FOR_TIME: {
      if (payload.capDurationMs && payload.capDurationMs > 0) {
        return `FOR TIME — Cap ${formatCapDuration(payload.capDurationMs)}`;
      }
      return "FOR TIME";
    }
    default: {
      return payload.phase;
    }
  }
};

export const formatSubtitle = (options: {
  isPaused?: boolean;
  pausedElapsedDisplayTime?: string;
  nextPhase?: TimerPhase | null;
  nextPhaseDurationMs?: number | null;
}): string => {
  if (options.isPaused && options.pausedElapsedDisplayTime) {
    return `Paused at ${options.pausedElapsedDisplayTime}`;
  }

  if (
    options.nextPhase &&
    options.nextPhaseDurationMs !== null &&
    options.nextPhaseDurationMs !== undefined &&
    options.nextPhaseDurationMs > 0
  ) {
    const seconds = Math.round(options.nextPhaseDurationMs / 1000);
    return `Next: ${options.nextPhase} (${seconds}s)`;
  }

  return "";
};

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

export class AndroidForegroundDriver implements LiveActivityDriver {
  private lastSessionPayload: ActiveSessionPayload | null = null;
  private isServiceActive = false;
  private controllerSubscription: { remove: () => void } | null = null;

  public async start(session: ActiveSessionPayload): Promise<void> {
    this.lastSessionPayload = session;
    this.isServiceActive = true;

    const headline = session.headline ?? formatHeadline(session);
    const subtitle =
      session.subtitle ??
      formatSubtitle({
        isPaused: session.isPaused,
        nextPhase: session.nextPhase,
        nextPhaseDurationMs: session.nextPhaseDurationMs,
      });
    const color = session.accentColor ?? getPhaseAccentColor(session.phase);
    const secondaryLabel =
      session.secondaryActionLabel ?? getSecondaryActionLabel(session.mode);

    await startForegroundService({
      color,
      headline,
      isPaused: session.isPaused,
      secondaryLabel,
      subtitle,
      targetTimestampMs: session.targetTimestampMs,
    });
  }

  public async update(session: ActiveSessionPayload): Promise<void> {
    this.lastSessionPayload = session;

    if (!this.isServiceActive) {
      return this.start(session);
    }

    const headline = session.headline ?? formatHeadline(session);
    const subtitle =
      session.subtitle ??
      formatSubtitle({
        isPaused: session.isPaused,
        nextPhase: session.nextPhase,
        nextPhaseDurationMs: session.nextPhaseDurationMs,
      });
    const color = session.accentColor ?? getPhaseAccentColor(session.phase);
    const secondaryLabel =
      session.secondaryActionLabel ?? getSecondaryActionLabel(session.mode);

    await updateForegroundService({
      color,
      headline,
      isPaused: session.isPaused,
      secondaryLabel,
      subtitle,
      targetTimestampMs: session.targetTimestampMs,
    });
  }

  public async pause(elapsedDisplayTime: string): Promise<void> {
    if (!this.lastSessionPayload) {
      return;
    }

    const pausedSession: ActiveSessionPayload = {
      ...this.lastSessionPayload,
      isPaused: true,
      subtitle: `Paused at ${elapsedDisplayTime}`,
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
}

export const createLiveActivityDriver = (
  platform: string = Platform.OS
): LiveActivityDriver => {
  if (platform === "android") {
    return new AndroidForegroundDriver();
  }
  return new IosNoopLiveActivityDriver();
};
