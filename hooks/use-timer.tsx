import type { WorkoutSummary } from '@/helpers/timer/controller';
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
}

export interface TimerEventHandlers {
  onGo?: () => void;
  onFinish?: (summary: WorkoutSummary) => void;
  onPhaseChange?: (phase: TimerPhase) => void;
  onRoundChange?: (round: number) => void;
  onBeep?: (second: number) => void;
}

const getTimerFlags = (config: TimerConfig, phase: TimerPhase): TimerFlags => {
  const isPreparing = phase === TimerPhase.PREPARATION;
  const isIntervalMode =
    config.mode === TimerMode.TABATA || config.mode === TimerMode.ON_OFF;
  const hasMultipleRounds = 'totalRounds' in config && config.totalRounds > 1;

  return {
    isPreparing,
    showsMinuteDigits: !isPreparing,
    showsPhaseIndicator: isIntervalMode && !isPreparing,
    showsRoundCounter: hasMultipleRounds && !isPreparing,
  };
};

const useTimerController = (
  config: TimerConfig,
  setTimerState: React.Dispatch<React.SetStateAction<TimerState>>,
  setStatus: React.Dispatch<React.SetStateAction<TimerStatus>>,
  handlers?: TimerEventHandlers
) => {
  const controllerRef = useRef<TimerController | null>(null);

  const startedAtRef = useRef<Date | null>(null);
  const endedAtRef = useRef<Date | null>(null);

  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  if (!controllerRef.current) {
    const strategy = createTimerStrategy(config);
    controllerRef.current = new TimerController(strategy, config.preparationMs);
  }

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

    return () => controller.dispose();
  }, [setTimerState, setStatus]);

  return { controllerRef, endedAtRef, startedAtRef };
};

export interface UIWorkoutSummary extends WorkoutSummary {
  startedAt: Date | null;
  endedAt: Date | null;
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

  const { controllerRef, startedAtRef, endedAtRef } = useTimerController(
    config,
    setTimerState,
    setStatus,
    handlers
  );

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

    return {
      ...coreSummary,
      endedAt: endedAtRef.current || new Date(),
      startedAt: startedAtRef.current || new Date(),
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
