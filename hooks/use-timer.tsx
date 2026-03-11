import type {
  CheckpointData,
  WorkoutSummary,
} from '@/helpers/timer/controller';
import { TimerController, TimerEventType } from '@/helpers/timer/controller';
import type { TimerConfig } from '@/helpers/timer/factory';
import { createTimerStrategy, TimerMode } from '@/helpers/timer/factory';
import type { TimerState } from '@/helpers/timer/strategy';
import { TimerPhase } from '@/helpers/timer/strategy';
import {
  formatTimeForDisplay,
  getModeAbbreviation,
} from '@/helpers/timer/utils/formatter';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export enum TimerStatus {
  READY = 'READY',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED',
}

export interface TimerFlags {
  isPreparing: boolean;
  showsPhaseIndicator: boolean;
  showsRoundCounter: boolean;
  showsMinuteDigits: boolean;
  showsSummaryRoundCounter: boolean;
  hasCheckpointsBehavior: boolean;
}

export interface UICheckpoint extends CheckpointData {
  recordedAt: Date;
}

export interface TimerEventHandlers {
  onGo?: () => void;
  onFinish?: (summary: WorkoutSummary) => void;
  onPhaseChange?: (phase: TimerPhase) => void;
  onRoundChange?: (round: number) => void;
  onBeep?: (second: number) => void;
  onCheckpoint?: (checkpoint: UICheckpoint) => void;
}

const getTimerFlags = (config: TimerConfig, phase: TimerPhase): TimerFlags => {
  const isPreparing = phase === TimerPhase.PREPARATION;
  const isIntervalMode = config.mode === TimerMode.INTERVAL;
  const hasMultipleRounds = 'totalRounds' in config && config.totalRounds > 1;
  const isStopwatchMode = config.mode === TimerMode.STOP_WATCH;

  return {
    hasCheckpointsBehavior:
      !isPreparing &&
      (config.mode === TimerMode.STOP_WATCH || config.mode === TimerMode.AMRAP),
    isPreparing,
    showsMinuteDigits: !isPreparing,
    showsPhaseIndicator: isIntervalMode && !isPreparing,
    showsRoundCounter: hasMultipleRounds && !isPreparing,
    showsSummaryRoundCounter: !isStopwatchMode,
  };
};

const useTimerInstance = (
  config: TimerConfig
): React.RefObject<TimerController | null> => {
  const controllerRef = useRef<TimerController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new TimerController(
      createTimerStrategy(config),
      config.preparationMs
    );
  }

  return controllerRef;
};

const useTimerController = (
  config: TimerConfig,
  setTimerState: React.Dispatch<React.SetStateAction<TimerState>>,
  setStatus: React.Dispatch<React.SetStateAction<TimerStatus>>,
  handlers?: TimerEventHandlers
) => {
  const controllerRef = useTimerInstance(config);

  const startedAtRef = useRef<Date | null>(null);
  const endedAtRef = useRef<Date | null>(null);

  const handlersRef = useRef(handlers);

  const checkpointsRef = useRef<UICheckpoint[]>([]);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // oxlint-disable eslint/max-statements
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    controller.on(TimerEventType.TICK, setTimerState);
    controller.on(TimerEventType.BEEP, (second: number) => {
      handlersRef.current?.onBeep?.(second);
    });
    controller.on(TimerEventType.GO, () => {
      startedAtRef.current = new Date();
      handlersRef.current?.onGo?.();
    });
    controller.on(TimerEventType.PHASE_CHANGE, (newPhase: TimerPhase) => {
      handlersRef.current?.onPhaseChange?.(newPhase);
    });
    controller.on(TimerEventType.ROUND_CHANGE, (newRound: number) => {
      handlersRef.current?.onRoundChange?.(newRound);
    });
    controller.on(TimerEventType.FINISH, (summary: WorkoutSummary) => {
      setStatus(TimerStatus.FINISHED);
      endedAtRef.current = new Date();
      handlersRef.current?.onFinish?.(summary);
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

    return () => controller.dispose();
  }, [setTimerState, setStatus, checkpointsRef, controllerRef]);

  return { checkpointsRef, controllerRef, endedAtRef, startedAtRef };
};

export interface UIWorkoutSummary extends Omit<WorkoutSummary, 'checkpoints'> {
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
    totalRounds: 'totalRounds' in config ? config.totalRounds : 1,
  });
  const [status, setStatus] = useState<TimerStatus>(TimerStatus.READY);

  const { controllerRef, startedAtRef, endedAtRef, checkpointsRef } =
    useTimerController(config, setTimerState, setStatus, handlers);

  const { minutes, seconds } = formatTimeForDisplay(timerState.displayTimeMs);

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
  }, []);

  const getSummary = useCallback((): UIWorkoutSummary | undefined => {
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
  }, []);

  return {
    ...timerState,
    flags,
    getSummary,
    handleEndSession,
    minutes,
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
    seconds,
    start: useCallback(() => {
      setStatus(TimerStatus.RUNNING);
      controllerRef.current?.start();
    }, [controllerRef]),
    status,
  };
};

export type timerType = ReturnType<typeof useTimer>;
