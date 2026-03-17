import { StyleSheet, View } from 'react-native';
import type { TimerMode } from '@/helpers/timer/factory';
import { useCallback, useState } from 'react';
import Button from '@/components/button';
import { Text } from '@/components/text';
import { Logo } from '@/components/logo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormPager } from './components/form-pager';
import { useTimerForms } from './hooks/use-timer-form';
import { TIMER_MODES } from './schema';
import { Link } from 'expo-router';
import { SlidersIcon } from 'phosphor-react-native';

export const Menu = () => {
  const [currentMode, setCurrentMode] = useState<TimerMode>(TIMER_MODES[0]);
  const { pages, startTimer } = useTimerForms();
  const inset = useSafeAreaInsets();

  const handleStart = useCallback(
    () => startTimer(currentMode),
    [startTimer, currentMode]
  );

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: inset.bottom, paddingTop: inset.top },
      ]}
    >
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
        >
          <View style={styles.footer}>
            <Link href="/settings" asChild>
              <Button size="icon" icon={SlidersIcon} variant="ghost" />
            </Link>

            <Button
              style={styles.fullSpace}
              title="Start"
              onPress={handleStart}
            />
          </View>
        </FormPager>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentHeading: {
    paddingLeft: 28,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fullSpace: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
});
