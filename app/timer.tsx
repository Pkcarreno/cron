import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/helpers/colors';
import { Link, useLocalSearchParams } from 'expo-router';
import { TimerStatus, useTimer } from '@/hooks/use-timer';
import type { TimerRouteParams } from '@/helpers/timer/utils/config-serializer';
import { deserializeTimerConfig } from '@/helpers/timer/utils/config-serializer';

export default function TimerScreen() {
  const rawConfigParams = useLocalSearchParams<TimerRouteParams>();
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
  } = useTimer(deserializeTimerConfig(rawConfigParams));

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Timer Screen</Text>

      <View style={timerStyles.container}>
        <Text style={timerStyles.text}>{minutes}</Text>
        <Text style={timerStyles.text}>:</Text>
        <Text style={timerStyles.text}>{seconds}</Text>
      </View>

      <View style={dataBoxStyles.container}>
        <Text style={dataBoxStyles.heading}>state</Text>
        <Text style={dataBoxStyles.text}>{'{'}</Text>
        <View style={dataBoxStyles.dataWrapper}>
          <Text style={dataBoxStyles.text}>mode {modeAbbr}</Text>
          <Text style={dataBoxStyles.text}>status {status}</Text>
          <Text style={dataBoxStyles.text}>phase {phase}</Text>
          <Text style={dataBoxStyles.text}>totalRounds {totalRounds}</Text>
          <Text style={dataBoxStyles.text}>currentRound {currentRound}</Text>
          <Text style={dataBoxStyles.text}>displayTimeMs {displayTimeMs}</Text>
        </View>
        <Text style={styles.text}>{'}'}</Text>
      </View>

      <View style={dataBoxStyles.container}>
        <Text style={dataBoxStyles.heading}>flags</Text>
        <Text style={dataBoxStyles.text}>{'{'}</Text>
        <View style={dataBoxStyles.dataWrapper}>
          <Text style={dataBoxStyles.text}>
            isPreparing {JSON.stringify(flags.isPreparing)}
          </Text>
          <Text style={dataBoxStyles.text}>
            showsPhaseIndicator {JSON.stringify(flags.showsPhaseIndicator)}
          </Text>
          <Text style={dataBoxStyles.text}>
            showsRoundCounter {JSON.stringify(flags.showsRoundCounter)}
          </Text>
          <Text style={dataBoxStyles.text}>
            showsTimeControls {JSON.stringify(flags.showsTimeControls)}
          </Text>
        </View>
        <Text style={styles.text}>{'}'}</Text>
      </View>

      <View style={buttonsStyles.container}>
        <View style={buttonsStyles.actionWrapper}>
          <Pressable onPress={start}>
            <Text
              style={
                status === TimerStatus.READY || status === TimerStatus.PAUSED
                  ? buttonsStyles.action
                  : buttonsStyles.actionDisabled
              }
              disabled={
                status === TimerStatus.READY || status === TimerStatus.PAUSED
              }
            >
              Start
            </Text>
          </Pressable>

          <Pressable onPress={pause}>
            <Text
              style={
                status === TimerStatus.RUNNING
                  ? buttonsStyles.action
                  : buttonsStyles.actionDisabled
              }
              disabled={status === TimerStatus.RUNNING}
            >
              Pause
            </Text>
          </Pressable>

          <Pressable onPress={reset}>
            <Text
              style={
                status === TimerStatus.READY
                  ? buttonsStyles.actionDisabled
                  : buttonsStyles.action
              }
              disabled={status !== TimerStatus.READY}
            >
              Reset
            </Text>
          </Pressable>
        </View>
        <Link href=".." style={buttonsStyles.link}>
          Back to Index
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  text: {
    color: colors.neutral[400],
    fontFamily: 'Geist',
    fontWeight: '400',
  },
});

const timerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  text: {
    color: colors.neutral[200],
    fontFamily: 'Geist Mono',
    fontSize: 24,
    fontWeight: '800',
  },
});

const dataBoxStyles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  dataWrapper: {
    paddingHorizontal: 8,
  },
  heading: {
    color: colors.neutral[400],
    fontFamily: 'Geist',
    fontSize: 16,
    fontWeight: '400',
  },
  text: {
    color: colors.neutral[400],
    fontFamily: 'Geist Mono',
    fontWeight: '400',
  },
});

const buttonsStyles = StyleSheet.create({
  action: {
    backgroundColor: colors.neutral[400],
    borderRadius: 10,
    color: colors.black,
    fontFamily: 'Geist Mono',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionDisabled: {
    backgroundColor: colors.neutral[700],
    borderRadius: 10,
    color: colors.black,
    fontFamily: 'Geist Mono',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionWrapper: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
  },
  container: {
    gap: 16,
  },
  link: {
    backgroundColor: colors.neutral[800],
    borderRadius: 10,
    color: colors.neutral[400],
    fontFamily: 'Geist Mono',
    fontSize: 18,
    fontWeight: '400',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
