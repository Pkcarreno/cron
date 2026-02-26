import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/helpers/colors';
import { Link } from 'expo-router';
import type { TimerConfig } from '@/helpers/timer/factory';
import { TimerMode } from '@/helpers/timer/factory';
import { serializeTimerConfig } from '@/helpers/timer/utils/config-serializer';
import { convertTimeToMs } from '@/helpers/timer/utils/formatter';
import { useCallback, useState } from 'react';
import type { FC, PropsWithChildren } from 'react';

const emomConfig: TimerConfig = {
  mode: TimerMode.EMOM,
  preparationMs: convertTimeToMs(0, 10),
  totalRounds: 3,
};
const tabataConfig: TimerConfig = {
  mode: TimerMode.TABATA,
  preparationMs: convertTimeToMs(0, 10),
  totalRounds: 8,
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
  const [inspectMode, setInspectMode] = useState(false);

  const handleToggleInspectMode = useCallback(() => {
    setInspectMode((prev) => !prev);
  }, [setInspectMode]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Index Screen</Text>
      <View style={buttonsStyles.linkWrapper}>
        <Text style={buttonsStyles.heading}>Jobs</Text>
        <TimerLink config={emomConfig} inspect={inspectMode}>
          EMOM
        </TimerLink>
        <TimerLink config={tabataConfig} inspect={inspectMode}>
          TABATA
        </TimerLink>
        <TimerLink config={amrapConfig} inspect={inspectMode}>
          AMRAP
        </TimerLink>
        <TimerLink config={onOffConfig} inspect={inspectMode}>
          ON/OFF
        </TimerLink>
        <TimerLink config={forTimeConfig} inspect={inspectMode}>
          FOR TIME
        </TimerLink>
        <View style={styles.optionsWrapper}>
          <Text style={buttonsStyles.heading}>
            Inspect mode screen: {inspectMode.toString()}
          </Text>
          <Pressable
            style={buttonsStyles.toggleInspectButton}
            onPress={handleToggleInspectMode}
          >
            <Text style={buttonsStyles.toggleInspectButtonText}>
              toggle inspect mode
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

interface TimerLinkProps extends PropsWithChildren {
  config: TimerConfig;
  inspect?: boolean;
  children: PropsWithChildren['children'] | string;
}

const TimerLink: FC<TimerLinkProps> = ({ config, inspect, children }) => (
  <Link
    href={{
      params: serializeTimerConfig(config),
      pathname: inspect ? '/timer/inspector' : '/timer',
    }}
    style={buttonsStyles.link}
  >
    {children}
  </Link>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  optionsWrapper: {
    gap: 6,
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
  toggleInspectButton: {
    borderColor: colors.neutral[500],
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  toggleInspectButtonText: {
    color: colors.neutral[500],
    fontFamily: 'Geist',
    fontWeight: '400',
  },
});
