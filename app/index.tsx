import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/helpers/colors';
import { Link } from 'expo-router';
import type { TimerConfig } from '@/helpers/timer/factory';
import { TimerMode } from '@/helpers/timer/factory';
import { serializeTimerConfig } from '@/helpers/timer/utils/config-serializer';
import { convertTimeToMs } from '@/helpers/timer/utils/formatter';

const emomConfig: TimerConfig = {
  mode: TimerMode.EMOM,
  preparationMs: convertTimeToMs(0, 10),
  totalRounds: 3,
};
const tabataConfig: TimerConfig = {
  mode: TimerMode.TABATA,
  preparationMs: convertTimeToMs(0, 10),
};
const onOffConfig: TimerConfig = {
  mode: TimerMode.ON_OFF,
  preparationMs: convertTimeToMs(0, 10),
  restMs: convertTimeToMs(0, 20),
  totalRounds: 3,
  workMs: convertTimeToMs(0, 30),
};
const amrapConfig: TimerConfig = {
  durationMs: convertTimeToMs(4, 0),
  mode: TimerMode.AMRAP,
  preparationMs: convertTimeToMs(0, 10),
};
const forTimeConfig: TimerConfig = {
  mode: TimerMode.FOR_TIME,
  preparationMs: convertTimeToMs(0, 10),
  timecapMs: convertTimeToMs(3, 0),
};

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Index Screen</Text>
      <View style={buttonsStyles.linkWrapper}>
        <Text style={buttonsStyles.heading}>Jobs</Text>
        <Link
          href={{
            params: serializeTimerConfig(emomConfig),
            pathname: '/timer/inspector',
          }}
          style={buttonsStyles.link}
        >
          EMOM
        </Link>
        <Link
          href={{
            params: serializeTimerConfig(tabataConfig),
            pathname: '/timer/inspector',
          }}
          style={buttonsStyles.link}
        >
          TABATA
        </Link>
        <Link
          href={{
            params: serializeTimerConfig(amrapConfig),
            pathname: '/timer/inspector',
          }}
          style={buttonsStyles.link}
        >
          AMRAP
        </Link>
        <Link
          href={{
            params: serializeTimerConfig(onOffConfig),
            pathname: '/timer/inspector',
          }}
          style={buttonsStyles.link}
        >
          ON/OFF
        </Link>
        <Link
          href={{
            params: serializeTimerConfig(forTimeConfig),
            pathname: '/timer/inspector',
          }}
          style={buttonsStyles.link}
        >
          FOR TIME
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

const buttonsStyles = StyleSheet.create({
  heading: {
    color: colors.neutral[500],
    fontFamily: 'Geist',
    fontWeight: '400',
  },
  link: {
    backgroundColor: colors.neutral[800],
    borderRadius: 10,
    color: colors.neutral[400],
    fontFamily: 'Geist',
    fontSize: 18,
    fontWeight: '400',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  linkWrapper: {
    gap: 8,
    justifyContent: 'center',
    width: '100%',
  },
});
