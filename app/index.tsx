import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { TimerConfig } from '@/helpers/timer/factory';
import { TimerMode } from '@/helpers/timer/factory';
import { serializeTimerConfig } from '@/helpers/timer/utils/config-serializer';
import { convertTimeToMs } from '@/helpers/timer/utils/formatter';
import { useCallback, useMemo, useState } from 'react';
import Button from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Logo } from '@/components/logo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormPager } from '@/components/menu-screen/form-pager';

const QUICK_ON_OFF = `QUICK_${TimerMode.ON_OFF}`;

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
  const [currentMode, setCurrentMode] = useState<
    TimerMode | typeof QUICK_ON_OFF
  >(TimerMode.EMOM);
  const router = useRouter();

  const handleToggleInspectMode = useCallback(() => {
    setInspectMode((prev) => !prev);
  }, [setInspectMode]);

  const modeConfig = useMemo(() => {
    switch (currentMode) {
      case TimerMode.EMOM: {
        return emomConfig;
      }

      case TimerMode.TABATA: {
        return tabataConfig;
      }

      case TimerMode.AMRAP: {
        return amrapConfig;
      }

      case TimerMode.ON_OFF: {
        return onOffConfig;
      }

      case QUICK_ON_OFF: {
        return quickOnOffConfig;
      }

      case TimerMode.FOR_TIME: {
        return forTimeConfig;
      }

      default: {
        return null;
      }
    }
  }, [currentMode]);

  const handleStart = useCallback(() => {
    if (modeConfig) {
      router.push({
        params: serializeTimerConfig(modeConfig),
        pathname: inspectMode ? '/timer/inspector' : '/timer',
      });
    }
  }, [modeConfig, inspectMode, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text weight="700" color="white" size={48}>
          Cron
        </Text>
        <Logo />
      </View>
      <View style={styles.content}>
        <Text weight="200" size={14} style={styles.contentHeading}>
          Job
        </Text>
        <FormPager
          value={currentMode}
          onValueChange={setCurrentMode}
          options={[
            {
              content: (
                <Placeholder page={TimerMode.EMOM} config={emomConfig} />
              ),
              label: TimerMode.EMOM,
              value: TimerMode.EMOM,
            },
            {
              content: (
                <Placeholder page={TimerMode.TABATA} config={tabataConfig} />
              ),
              label: TimerMode.TABATA,
              value: TimerMode.TABATA,
            },
            {
              content: (
                <Placeholder page={TimerMode.AMRAP} config={amrapConfig} />
              ),
              label: TimerMode.AMRAP,
              value: TimerMode.AMRAP,
            },
            {
              content: (
                <Placeholder page={TimerMode.ON_OFF} config={onOffConfig} />
              ),
              label: TimerMode.ON_OFF,
              value: TimerMode.ON_OFF,
            },
            {
              content: (
                <Placeholder page={QUICK_ON_OFF} config={quickOnOffConfig} />
              ),
              label: QUICK_ON_OFF,
              value: QUICK_ON_OFF,
            },
            {
              content: (
                <Placeholder page={TimerMode.FOR_TIME} config={forTimeConfig} />
              ),
              label: TimerMode.FOR_TIME,
              value: TimerMode.FOR_TIME,
            },
          ]}
        />
      </View>

      <View style={styles.footer}>
        <Button
          title={`toggle inspect mode: ${inspectMode.toString()}`}
          variant="outline"
          size="sm"
          onPress={handleToggleInspectMode}
        />

        <Button title="Start" onPress={handleStart} />
      </View>
    </SafeAreaView>
  );
}

interface PlaceholderProps {
  page: string;
  config: TimerConfig;
}

const Placeholder: React.FC<PlaceholderProps> = ({ config }) => (
  <View style={placeholderStyles.container}>
    <View style={placeholderStyles.content}>
      {Object.entries(config).map(([key, value]) => (
        <View key={`${key}-${value}`}>
          <Text colorSubtone="500">{key}</Text>
          <Text fontType="mono" size={16}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

const placeholderStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 8,
    paddingHorizontal: 8,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingBottom: 12,
  },
  content: {
    flex: 1,
  },
  contentHeading: {
    paddingLeft: 28,
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
