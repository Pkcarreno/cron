import { HideNavigationBar } from '@/components/hide-navigation-bar';
import { TimerFace } from '@/components/timer/timer-face';
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
  const { minutes, seconds, phase, currentRound, flags, start, reset } =
    useTimer(timerInput, {});
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
