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
  showsTimeControls: boolean;
}

export interface TimerEventHandlers {
  onGo?: () => void;
  onFinish?: () => void;
  onPhaseChange?: (phase: TimerPhase) => void;
  onRoundChange?: (round: number) => void;
  onBeep?: (second: number) => void;
}

const getTimerFlags = (
  config: TimerConfig,
  phase: TimerPhase,
  status: TimerStatus
): TimerFlags => {
  const isPreparing = phase === TimerPhase.PREPARATION;
  const isIntervalMode =
    config.mode === TimerMode.TABATA || config.mode === TimerMode.ON_OFF;
  const hasMultipleRounds = 'totalRounds' in config && config.totalRounds > 1;

  return {
    isPreparing,
    showsPhaseIndicator: isIntervalMode && !isPreparing,
    showsRoundCounter: hasMultipleRounds && !isPreparing,
    showsTimeControls: status !== TimerStatus.FINISHED,
  };
};

const useTimerController = (
  config: TimerConfig,
  setTimerState: React.Dispatch<React.SetStateAction<TimerState>>,
  setStatus: React.Dispatch<React.SetStateAction<TimerStatus>>,
  handlers?: TimerEventHandlers
) => {
  const controllerRef = useRef<TimerController | null>(null);

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
      handlersRef.current?.onGo?.();
    });
    controller.on(TimerEventType.PHASE_CHANGE, (newPhase: TimerPhase) => {
      handlersRef.current?.onPhaseChange?.(newPhase);
    });
    controller.on(TimerEventType.ROUND_CHANGE, (newRound: number) => {
      handlersRef.current?.onRoundChange?.(newRound);
    });
    controller.on(TimerEventType.FINISH, () => {
      setStatus(TimerStatus.FINISHED);
      handlersRef.current?.onFinish?.();
    });

    return () => controller.dispose();
  }, [setTimerState, setStatus]);

  return controllerRef;
};

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

  const controllerRef = useTimerController(
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
    () => getTimerFlags(config, timerState.phase, status),
    [config, timerState.phase, status]
  );

  return {
    ...timerState,
    flags,
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
