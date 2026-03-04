import { ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '@/helpers/colors';
import { Link, useLocalSearchParams } from 'expo-router';
import { TimerStatus, useTimer } from '@/hooks/use-timer';
import type { TimerRouteParams } from '@/helpers/timer/utils/config-serializer';
import { deserializeTimerConfig } from '@/helpers/timer/utils/config-serializer';
import { useKeepAwake } from 'expo-keep-awake';
import type { TimerPhase } from '@/helpers/timer/strategy';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import Button from '@/components/ui/button';

interface logType {
  time: string;
  message: string;
}

export const TimerInspect = () => {
  const rawConfigParams = useLocalSearchParams<TimerRouteParams>();
  const [eventLogs, setEventLogs] = useState<logType[]>([]);

  const addLog = (message: string) => {
    const timeString = new Date().toLocaleTimeString();
    setEventLogs((prev) => [
      {
        message,
        time: timeString,
      },
      ...prev,
    ]);
  };

  const timerInput = deserializeTimerConfig(rawConfigParams);

  const {
    minutes,
    seconds,
    phase,
    totalRounds,
    currentRound,
    displayTimeMs,
    flags,
    modeAbbr,
    status,
    start,
    pause,
    reset,
  } = useTimer(timerInput, {
    onBeep: (second: number) => addLog(`beep on ${second} left`),
    onFinish: () => addLog('finish'),
    onGo: () => addLog('Go'),
    onPhaseChange: (newPhase: TimerPhase) =>
      addLog(`on phase change: ${newPhase}`),
    onRoundChange: (newRound: number) => addLog(`on round change: ${newRound}`),
  });

  useKeepAwake();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text>Timer Screen</Text>

        <View style={timerStyles.container}>
          <Text colorSubtone="200" size={24} weight="800" fontType="mono">
            {minutes}
          </Text>
          <Text colorSubtone="200" size={24} weight="800" fontType="mono">
            :
          </Text>
          <Text colorSubtone="200" size={24} weight="800" fontType="mono">
            {seconds}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={dataBoxStyles.container}>
          <Text>input</Text>
          <View style={dataBoxStyles.dataWrapper}>
            {Object.entries(timerInput).map(([key, value]) => (
              <View
                key={`${key}-${value}`}
                style={dataBoxStyles.dataElementWrapper}
              >
                <Text colorSubtone="600" fontType="mono">
                  {key}
                </Text>
                <Text fontType="mono">{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={dataBoxStyles.container}>
          <Text>state</Text>
          <View style={dataBoxStyles.dataWrapper}>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                modeAbbr
              </Text>
              <Text fontType="mono">{modeAbbr}</Text>
            </View>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                status
              </Text>
              <Text fontType="mono">{status}</Text>
            </View>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                phase
              </Text>
              <Text fontType="mono">{phase}</Text>
            </View>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                totalRounds
              </Text>
              <Text fontType="mono">{totalRounds}</Text>
            </View>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                currentRound
              </Text>
              <Text fontType="mono">{currentRound}</Text>
            </View>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                displayTimeMs
              </Text>
              <Text fontType="mono">{displayTimeMs}</Text>
            </View>
          </View>
        </View>

        <View style={dataBoxStyles.container}>
          <Text>flags</Text>
          <View style={dataBoxStyles.dataWrapper}>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                isPreparing
              </Text>
              <Text fontType="mono">{flags.isPreparing.toString()}</Text>
            </View>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                showsPhaseIndicator
              </Text>
              <Text fontType="mono">
                {flags.showsPhaseIndicator.toString()}
              </Text>
            </View>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                showsRoundCounter
              </Text>
              <Text fontType="mono">{flags.showsRoundCounter.toString()}</Text>
            </View>
            <View style={dataBoxStyles.dataElementWrapper}>
              <Text colorSubtone="600" fontType="mono">
                showsMinuteDigits
              </Text>
              <Text fontType="mono">{flags.showsMinuteDigits.toString()}</Text>
            </View>
          </View>
        </View>

        <View style={logStyles.container}>
          <Text size={16}>logs</Text>
          <ScrollView style={logStyles.logWrapper}>
            {eventLogs.map((log) => (
              <View
                key={`${log.time}-${log.message}`}
                style={logStyles.logItemWrapper}
              >
                <Text colorSubtone="600" fontType="mono">
                  [{log.time}]
                </Text>
                <Text fontType="mono">{log.message}</Text>
              </View>
            ))}
            {eventLogs.length === 0 && (
              <Text colorSubtone="500">No log yet</Text>
            )}
          </ScrollView>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.row}>
          <Button
            title="Start"
            onPress={start}
            disabled={
              status !== TimerStatus.READY && status !== TimerStatus.PAUSED
            }
          />

          <Button
            title="Pause"
            onPress={pause}
            disabled={status !== TimerStatus.RUNNING}
          />

          <Button
            title="Reset"
            onPress={reset}
            disabled={status === TimerStatus.READY}
          />
        </View>

        <Link href=".." asChild>
          <Button title="Back to menu" variant="secondary" />
        </Link>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    gap: 8,
    paddingVertical: 12,
  },
  footer: {
    gap: 8,
  },
  header: {},
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});

const timerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
});

const dataBoxStyles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  dataElementWrapper: {
    flexDirection: 'row',
    gap: 8,
  },
  dataWrapper: {
    paddingHorizontal: 8,
  },
});

const logStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 4,
  },
  logItemWrapper: {
    flexDirection: 'row',
    gap: 8,
  },
  logWrapper: {
    borderColor: colors.neutral[800],
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    marginTop: 4,
    paddingHorizontal: 8,
  },
});
