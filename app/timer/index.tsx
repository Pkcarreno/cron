import { HideNavigationBar } from '@/components/hide-navigation-bar';
import { TimerFace } from '@/components/timer/timer-face';
import { playTone, playToneSequence } from '@/helpers/playback-service';
import { TimerPhase } from '@/helpers/timer/strategy';
import { deserializeTimerConfig } from '@/helpers/timer/utils/config-serializer';
import type { TimerRouteParams } from '@/helpers/timer/utils/config-serializer';
import { useIsLowBattery } from '@/hooks/use-is-low-battery';
import { useTimer } from '@/hooks/use-timer';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
    start,
    reset,
  } = useTimer(timerInput, {
    onBeep: () => playTone(659, 200),
    onFinish: () =>
      playToneSequence([
        { durationMs: 300, frequencyHz: 523, silenceAfterMs: 150 },
        { durationMs: 300, frequencyHz: 523, silenceAfterMs: 150 },
        { durationMs: 800, frequencyHz: 523, silenceAfterMs: 0 },
      ]),
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
  const isLowBattery = useIsLowBattery();

  useKeepAwake();

  useEffect(() => {
    start();

    return () => {
      reset();
    };
  }, [start, reset]);

  return (
    <SafeAreaProvider>
      <StatusBar hidden={true} />
      <HideNavigationBar />

      <TimerFace
        phase={phase}
        minutes={minutes}
        seconds={seconds}
        currentRound={currentRound}
        currentTime={currentTime}
        modeAbbr={modeAbbr}
        flags={flags}
        isLowBattery={isLowBattery}
      />
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
