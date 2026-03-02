import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import type { TimerConfig } from '@/helpers/timer/factory';
import { TimerMode } from '@/helpers/timer/factory';
import { serializeTimerConfig } from '@/helpers/timer/utils/config-serializer';
import { convertTimeToMs } from '@/helpers/timer/utils/formatter';
import { useCallback, useState } from 'react';
import type { FC } from 'react';
import Button from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Logo } from '@/components/logo';
import { SafeAreaView } from 'react-native-safe-area-context';

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
const quickOnOffConfig: TimerConfig = {
  mode: TimerMode.ON_OFF,
  preparationMs: convertTimeToMs(0, 5),
  restMs: convertTimeToMs(0, 5),
  totalRounds: 2,
  workMs: convertTimeToMs(0, 5),
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text weight="700" color="white" size={48}>
          Cron
        </Text>
        <Logo />
      </View>
      <View style={styles.content}>
        <View style={buttonsStyles.linkWrapper}>
          <Text colorSubtone="500">Jobs</Text>
          <TimerLink config={emomConfig} inspect={inspectMode} title="EMOM" />
          <TimerLink
            config={tabataConfig}
            inspect={inspectMode}
            title="TABATA"
          />
          <TimerLink config={amrapConfig} inspect={inspectMode} title="AMRAP" />
          <TimerLink
            config={onOffConfig}
            inspect={inspectMode}
            title="ON_OFF"
          />
          <TimerLink
            config={quickOnOffConfig}
            inspect={inspectMode}
            title="QUICK ON_OFF"
          />
          <TimerLink
            config={forTimeConfig}
            inspect={inspectMode}
            title="FOR_TIME"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text colorSubtone="500">
          Inspect mode screen: {inspectMode.toString()}
        </Text>
        <Button
          title="toggle inspect mode"
          variant="outline"
          size="sm"
          onPress={handleToggleInspectMode}
        />
      </View>
    </SafeAreaView>
  );
}

interface TimerLinkProps {
  config: TimerConfig;
  inspect?: boolean;
  title: string;
}

const TimerLink: FC<TimerLinkProps> = ({ config, inspect, title }) => (
  <Link
    href={{
      params: serializeTimerConfig(config),
      pathname: inspect ? '/timer/inspector' : '/timer',
    }}
    asChild
  >
    <Button title={title} variant="secondary" size="sm" />
  </Link>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingBottom: 12,
  },
  content: {
    flex: 1,
    gap: 16,
    paddingVertical: 12,
  },
  footer: {
    gap: 8,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
});

const buttonsStyles = StyleSheet.create({
  linkWrapper: {
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
});
