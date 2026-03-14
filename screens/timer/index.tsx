import { HideNavigationBar } from '@/components/hide-navigation-bar';
import { PressableArea } from '@/components/pressable-area';
import { SummaryFace } from './components/summary-face';
import { TimerFace } from './components/timer-face';
import { playTone, playToneSequence } from '@/helpers/playback-service';
import { TimerPhase } from '@/helpers/timer/strategy';
import { deserializeTimerConfig } from '@/helpers/timer/utils/config-serializer';
import type { TimerRouteParams } from '@/helpers/timer/utils/config-serializer';
import { useGetCurrentTime } from '@/hooks/use-get-current-time';
import { TimerStatus, useTimer } from '@/hooks/use-timer';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo } from 'react';
import { TimerMode } from '@/helpers/timer/factory';
import { colors } from '@/helpers/colors';
import type { ContextFormatType } from './types';

// oxlint-disable eslint/max-statements
export const Timer = () => {
  const rawConfigParams = useLocalSearchParams<TimerRouteParams>();
  const timerInput = deserializeTimerConfig(rawConfigParams);
  const {
    hours,
    minutes,
    seconds,
    phase,
    currentRound,
    checkpoints,
    modeAbbr,
    flags,
    pause,
    start,
    reset,
    recordCheckpoint,
    status,
    getSummary,
    handleEndSession,
  } = useTimer(timerInput, {
    onBeep: () => playTone(659, 200),
    onCheckpoint: () => {
      playToneSequence([
        { durationMs: 80, frequencyHz: 880, silenceAfterMs: 120 },
        { durationMs: 80, frequencyHz: 880, silenceAfterMs: 0 },
      ]);
    },
    onFinish: (summary) => {
      if (summary.fullyCompleted) {
        playToneSequence([
          { durationMs: 300, frequencyHz: 523, silenceAfterMs: 150 },
          { durationMs: 300, frequencyHz: 523, silenceAfterMs: 150 },
          { durationMs: 800, frequencyHz: 523, silenceAfterMs: 0 },
        ]);
      }
    },
    onGo: () => playTone(880, 600),
    onPhaseChange: (newPhase) => {
      if (newPhase === TimerPhase.REST) {
        playTone(523, 500);
      }
    },
    onRoundChange: () =>
      playToneSequence([
        { durationMs: 200, frequencyHz: 698, silenceAfterMs: 100 },
        { durationMs: 200, frequencyHz: 698, silenceAfterMs: 0 },
      ]),
  });
  const currentTime = useGetCurrentTime();

  const router = useRouter();

  const handleFinish = useCallback(() => {
    if (status !== TimerStatus.FINISHED) {
      handleEndSession();
    }

    router.back();
  }, [handleEndSession, router, status]);

  useEffect(() => {
    start();

    return () => {
      reset();
    };
  }, [start, reset]);

  const timerContextLabelState = useMemo<ContextFormatType>(() => {
    if (phase === TimerPhase.PREPARATION) {
      return {
        value: undefined,
      };
    }
    switch (timerInput.mode) {
      case TimerMode.AMRAP: {
        return {
          color: colors.red,
          value: checkpoints.at(-1)?.lap ? 'RND' : undefined,
        };
      }

      case TimerMode.INTERVAL: {
        const isActivePhase =
          phase === TimerPhase.WORK || phase === TimerPhase.REST;
        const value = isActivePhase ? phase : undefined;
        const color = phase === TimerPhase.WORK ? colors.blue : colors.green;
        return {
          color,
          value,
        };
      }

      default: {
        return {
          value: undefined,
        };
      }
    }
  }, [timerInput, phase, checkpoints]);

  const timerContextValueState = useMemo<ContextFormatType>(() => {
    if (phase === TimerPhase.PREPARATION) {
      return {
        value: undefined,
      };
    }
    switch (timerInput.mode) {
      case TimerMode.AMRAP: {
        return {
          value: checkpoints.at(-1)?.lap ?? undefined,
        };
      }

      case TimerMode.INTERVAL: {
        return {
          value: currentRound,
        };
      }

      default: {
        return {
          value: undefined,
        };
      }
    }
  }, [timerInput, phase, currentRound, checkpoints]);

  if (status === TimerStatus.PAUSED || status === TimerStatus.FINISHED) {
    return (
      <SummaryFace
        summary={getSummary()}
        mode={timerInput.mode}
        handleEndSession={handleFinish}
        handleResumeSession={start}
      />
    );
  }

  return (
    <>
      <StatusBar hidden={true} />
      <HideNavigationBar />

      <PressableArea
        onLongPress={pause}
        onDoublePress={
          flags.hasCheckpointsBehavior ? recordCheckpoint : undefined
        }
        deadZone={14}
      >
        <TimerFace
          hours={hours}
          lap={
            checkpoints &&
            checkpoints.length > 0 &&
            timerInput.mode === TimerMode.STOP_WATCH
              ? checkpoints.at(-1)?.lap
              : undefined
          }
          delta={
            checkpoints &&
            checkpoints.length > 0 &&
            timerInput.mode === TimerMode.STOP_WATCH
              ? checkpoints.at(-1)?.lapDeltaMs
              : undefined
          }
          minutes={minutes}
          seconds={seconds}
          contextLabel={timerContextLabelState.value}
          contextLabelColor={timerContextLabelState.color}
          contextValue={timerContextValueState.value}
          contextValueColor={timerContextValueState.color}
          currentTime={currentTime}
          modeAbbr={modeAbbr}
          flags={flags}
        />
      </PressableArea>
    </>
  );
};
