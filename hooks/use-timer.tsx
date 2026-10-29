import { useAtom } from "jotai/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppStateStatus } from "react-native";
import { AppState } from "react-native";

import type {
  CheckpointData,
  SessionSummary,
  TimerControllerOptions,
} from "@/helpers/timer/controller";
import { TimerController, TimerEventType } from "@/helpers/timer/controller";
import type { TimerConfig } from "@/helpers/timer/factory";
import { createTimerStrategy, TimerMode } from "@/helpers/timer/factory";
import type { TimerState } from "@/helpers/timer/strategy";
import { TimerPhase } from "@/helpers/timer/strategy";
import {
  formatTimeForDisplay,
  getModeAbbreviation,
} from "@/helpers/timer/utils/formatter";
import type { AudioFeedbackService } from "@/services/audio/audio-feedback-service";
import type { FeedbackServiceInterface } from "@/services/audio/feedback-service";
import { preparationTimeMsAtom } from "@/stores/settings";

export enum TimerStatus {
  READY = "READY",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
}

export interface TimerFlags {
  isPreparing: boolean;
  showsMinuteDigits: boolean;
  hasCheckpointsBehavior: boolean;
}

export interface UICheckpoint extends CheckpointData {
  recordedAt: Date;
}

export interface TimerEventHandlers {
  onGo?: () => void;
  onFinish?: (summary: SessionSummary) => void;
  onPhaseChange?: (phase: TimerPhase) => void;
  onRoundChange?: (round: number) => void;
  onBeep?: (second: number) => void;
  onCheckpoint?: (checkpoint: UICheckpoint) => void;
  feedbackService?: FeedbackServiceInterface;
  /**
   * @deprecated Use `feedbackService` instead.
   */
  audioService?: AudioFeedbackService;
}

const getTimerFlags = (config: TimerConfig, phase: TimerPhase): TimerFlags => {
  const isPreparing = phase === TimerPhase.PREPARATION;

  return {
    hasCheckpointsBehavior:
      !isPreparing &&
      (config.mode === TimerMode.STOP_WATCH || config.mode === TimerMode.AMRAP),
    isPreparing,
    showsMinuteDigits: !isPreparing,
  };
};

export const useTimerInstance = (
  config: TimerConfig,
  service?: FeedbackServiceInterface | AudioFeedbackService
): React.RefObject<TimerController | null> => {
  const [preparationTimeMs] = useAtom(preparationTimeMsAtom);
  const controllerRef = useRef<TimerController | null>(null);
  const prevConfigKeyRef = useRef<string>("");
  const prevPrepTimeRef = useRef<number>(preparationTimeMs);
  const prevServiceRef = useRef<
    FeedbackServiceInterface | AudioFeedbackService | undefined
  >(service);

  const configKey = JSON.stringify(config);

  if (
    !controllerRef.current ||
    prevConfigKeyRef.current !== configKey ||
    prevPrepTimeRef.current !== preparationTimeMs ||
    prevServiceRef.current !== service
  ) {
    if (controllerRef.current) {
      controllerRef.current.dispose();
    }

    const options: TimerControllerOptions = {
      uiTickResolutionMs:
        config.mode === TimerMode.STOP_WATCH && "uiTickResolutionMs" in config
          ? config.uiTickResolutionMs
          : undefined,
    };

    controllerRef.current = new TimerController(
      createTimerStrategy(config),
      preparationTimeMs,
      options
    );
    prevConfigKeyRef.current = configKey;
    prevPrepTimeRef.current = preparationTimeMs;
    prevServiceRef.current = service;
  }

  useEffect(
    () => () => {
      if (controllerRef.current) {
        controllerRef.current.dispose();
        controllerRef.current = null;
      }
    },
    []
  );

  return controllerRef;
};

export const useTimerController = (
  config: TimerConfig,
  setTimerState: React.Dispatch<React.SetStateAction<TimerState>>,
  setStatus: React.Dispatch<React.SetStateAction<TimerStatus>>,
  handlers?: TimerEventHandlers
) => {
  const activeService = handlers?.feedbackService ?? handlers?.audioService;
  const controllerRef = useTimerInstance(config, activeService);
  const controller = controllerRef.current;

  const startedAtRef = useRef<Date | null>(null);
  const endedAtRef = useRef<Date | null>(null);

  const handlersRef = useRef(handlers);

  const checkpointsRef = useRef<UICheckpoint[]>([]);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!controller || !handlers?.feedbackService) {
      return;
    }

    const detach = handlers.feedbackService.attach(controller);
    return () => {
      detach();
    };
  }, [controller, handlers?.feedbackService]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      controllerRef.current?.handleAppStateChange(nextState);
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => {
      sub?.remove?.();
      // oxlint-disable-next-line typescript/no-explicit-any
      (AppState as any).removeEventListener?.("change", handleAppState);
    };
  }, [controllerRef]);

  // oxlint-disable eslint/max-statements
  useEffect(() => {
    if (!controller) {
      return;
    }

    controller.on(TimerEventType.UI_TICK, setTimerState);
    controller.on(TimerEventType.BEEP, (second: number) => {
      handlersRef.current?.onBeep?.(second);
      if (!handlersRef.current?.feedbackService) {
        void handlersRef.current?.audioService?.playCountdownBeep(second);
      }
    });
    controller.on(TimerEventType.GO, () => {
      startedAtRef.current = new Date();
      handlersRef.current?.onGo?.();
      if (!handlersRef.current?.feedbackService) {
        void handlersRef.current?.audioService?.playGoCue();
      }
    });
    controller.on(TimerEventType.PHASE_CHANGE, (newPhase: TimerPhase) => {
      handlersRef.current?.onPhaseChange?.(newPhase);
      if (!handlersRef.current?.feedbackService) {
        void handlersRef.current?.audioService?.playPhaseTransitionCue(
          newPhase
        );
      }
    });
    controller.on(TimerEventType.ROUND_CHANGE, (newRound: number) => {
      handlersRef.current?.onRoundChange?.(newRound);
      if (!handlersRef.current?.feedbackService) {
        void handlersRef.current?.audioService?.playRoundChangeCue?.(newRound);
      }
    });
    controller.on(TimerEventType.FINISH, (summary: SessionSummary) => {
      setStatus(TimerStatus.FINISHED);
      endedAtRef.current = new Date();
      handlersRef.current?.onFinish?.(summary);
      if (!handlersRef.current?.feedbackService) {
        void handlersRef.current?.audioService?.playFinishCue(
          summary.fullyCompleted
        );
      }
    });
    controller.on(TimerEventType.PAUSE, () => {
      if (!handlersRef.current?.feedbackService) {
        handlersRef.current?.audioService?.stopAudio();
      }
    });
    controller.on(TimerEventType.RESET, () => {
      if (!handlersRef.current?.feedbackService) {
        handlersRef.current?.audioService?.stopAudio();
      }
    });
    controller.on(
      TimerEventType.CHECKPOINT,
      (checkpointData: CheckpointData) => {
        const enrichedCheckpoint: UICheckpoint = {
          ...checkpointData,
          recordedAt: new Date(),
        };
        checkpointsRef.current.push(enrichedCheckpoint);
        handlersRef.current?.onCheckpoint?.(enrichedCheckpoint);
      }
    );

    return () => {
      controller.dispose();
      checkpointsRef.current = [];
      startedAtRef.current = null;
      endedAtRef.current = null;
    };
  }, [controller, setTimerState, setStatus]);

  return { checkpointsRef, controllerRef, endedAtRef, startedAtRef };
};

export interface UISessionSummary extends Omit<SessionSummary, "checkpoints"> {
  startedAt: Date | null;
  endedAt: Date | null;
  checkpoints: UICheckpoint[];
}

export const useTimer = (
  config: TimerConfig,
  handlers?: TimerEventHandlers
) => {
  const [timerState, setTimerState] = useState<TimerState>({
    currentRound: 0,
    displayTimeMs: 0,
    isFinished: false,
    phase: TimerPhase.PREPARATION,
    totalRounds: "totalRounds" in config ? config.totalRounds : 1,
  });
  const [status, setStatus] = useState<TimerStatus>(TimerStatus.READY);

  const { controllerRef, startedAtRef, endedAtRef, checkpointsRef } =
    useTimerController(config, setTimerState, setStatus, handlers);

  const totalRounds =
    "totalRounds" in config ? config.totalRounds : timerState.totalRounds;

  const formattedTime = formatTimeForDisplay(
    timerState.displayTimeMs,
    config.mode === TimerMode.STOP_WATCH
  );

  const modeAbbr = useMemo(
    () => getModeAbbreviation(config.mode),
    [config.mode]
  );

  const flags = useMemo(
    () => getTimerFlags(config, timerState.phase),
    [config, timerState.phase]
  );

  const handleEndSession = useCallback(() => {
    setStatus(TimerStatus.FINISHED);
    controllerRef.current?.finishTimer();
    // oxlint-disable eslint/exhaustive-deps
  }, [controllerRef]);

  const getSummary = useCallback((): UISessionSummary | undefined => {
    const coreSummary = controllerRef.current?.getSummary();
    if (!coreSummary) {
      return;
    }

    const currentDate = new Date();

    return {
      ...coreSummary,
      checkpoints: checkpointsRef.current,
      endedAt: endedAtRef.current || currentDate,
      startedAt: startedAtRef.current || currentDate,
    };
    // oxlint-disable eslint/exhaustive-deps
  }, [checkpointsRef, controllerRef, endedAtRef, startedAtRef]);

  return {
    ...timerState,
    ...formattedTime,
    checkpoints: checkpointsRef.current,
    flags,
    getSummary,
    handleEndSession,
    modeAbbr,
    pause: useCallback(() => {
      setStatus(TimerStatus.PAUSED);
      controllerRef.current?.pause();
    }, [controllerRef]),
    recordCheckpoint: () => controllerRef.current?.recordCheckpoint(),
    reset: useCallback(() => {
      setStatus(TimerStatus.READY);
      controllerRef.current?.reset();
    }, [controllerRef]),
    start: useCallback(() => {
      setStatus(TimerStatus.RUNNING);
      controllerRef.current?.start();
    }, [controllerRef]),
    status,
    totalRounds,
  };
};

export type timerType = ReturnType<typeof useTimer>;
