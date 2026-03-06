import { StyleSheet, View } from 'react-native';
import { TimerMode } from '@/helpers/timer/factory';
import { useCallback, useState } from 'react';
import Button from '@/components/button';
import { Text } from '@/components/text';
import { Logo } from '@/components/logo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormPager } from './components/form-pager';
import { useTimerForms } from './hooks/use-timer-form';

export const Menu = () => {
  const [inspectMode, setInspectMode] = useState(false);
  const [currentMode, setCurrentMode] = useState<
    Exclude<TimerMode, 'STOP_WATCH'>
  >(TimerMode.EMOM);
  const { pages, startTimer } = useTimerForms(inspectMode);

  const handleToggleInspectMode = useCallback(() => {
    setInspectMode((prev) => !prev);
  }, [setInspectMode]);

  const handleStart = useCallback(
    () => startTimer(currentMode),
    [startTimer, currentMode]
  );

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
          options={pages}
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
};

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
