import { HideNavigationBar } from '@/components/hide-navigation-bar';
import { PressableArea } from '@/components/pressable-area';
import { SummaryFace } from '@/components/timer-screen/summary-face';
import { TimerFace } from '@/components/timer-screen/timer-face';
import { playTone, playToneSequence } from '@/helpers/playback-service';
import { TimerPhase } from '@/helpers/timer/strategy';
import { deserializeTimerConfig } from '@/helpers/timer/utils/config-serializer';
import type { TimerRouteParams } from '@/helpers/timer/utils/config-serializer';
import { TimerStatus, useTimer } from '@/hooks/use-timer';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function TimerScreen() {
  const rawConfigParams = useLocalSearchParams<TimerRouteParams>();
  const timerInput = deserializeTimerConfig(rawConfigParams);
  const {
    minutes,
    seconds,
    phase,
    currentRound,
    modeAbbr,
    flags,
    pause,
    start,
    reset,
    status,
    getSummary,
    handleEndSession,
  } = useTimer(timerInput, {
    onBeep: () => playTone(659, 200),
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
    <SafeAreaProvider>
      <StatusBar hidden={true} />
      <HideNavigationBar />

      <PressableArea onLongPress={pause} deadZone={14}>
        <TimerFace
          phase={phase}
          minutes={minutes}
          seconds={seconds}
          currentRound={currentRound}
          currentTime={currentTime}
          modeAbbr={modeAbbr}
          flags={flags}
        />
      </PressableArea>
    </SafeAreaProvider>
  );
}

const useGetCurrentTime = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedCurrentTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return formattedCurrentTime;
};
