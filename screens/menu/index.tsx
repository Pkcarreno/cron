import { StyleSheet, View } from 'react-native';
import type { TimerMode } from '@/helpers/timer/factory';
import { useCallback, useState } from 'react';
import Button from '@/components/button';
import { Text } from '@/components/text';
import { Logo } from '@/components/logo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormPager } from './components/form-pager';
import { useTimerForms } from './hooks/use-timer-form';
import { TIMER_MODES } from './schema';
import { Link } from 'expo-router';
import { SlidersIcon } from 'phosphor-react-native';

export const Menu = () => {
  const [currentMode, setCurrentMode] = useState<TimerMode>(TIMER_MODES[0]);
  const { pages, startTimer } = useTimerForms();

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
        <Link href="/settings" asChild>
          <Button size="icon" icon={SlidersIcon} variant="ghost" />
        </Link>

        <Button style={styles.fullSpace} title="Start" onPress={handleStart} />
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
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
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
