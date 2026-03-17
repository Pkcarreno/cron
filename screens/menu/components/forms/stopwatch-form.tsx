import { useImperativeHandle } from 'react';
import type { Ref } from 'react';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';

interface StopWatchFormProps {
  ref?: Ref<FormHandle>;
  paddingBottom: number;
  onSubmit: (config: TimerConfig) => void;
}

export const StopWatchForm = ({
  onSubmit,
  paddingBottom,
  ref,
}: StopWatchFormProps) => {
  useImperativeHandle(ref, () => ({
    submit: () => {
      const config: TimerConfig = {
        mode: TimerMode.STOP_WATCH,
      };
      onSubmit(config);
    },
  }));

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom }]}
    >
      <View style={styles.contentWrapper}>
        <View style={styles.header}>
          <Text color="white" size={22} weight="700">
            All set!
          </Text>
        </View>
        <View style={styles.content}>
          <Text colorSubtone="300">
            You are in control. The timer will only end when you choose to stop
            it.
          </Text>
          <View>
            <Text>Quick tips:</Text>
            <Text>- Long press anywhere to finish the timer.</Text>
            <Text>- Double tap to log a checkpoint.</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 8,
  },
  contentContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  contentWrapper: {
    gap: 12,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
  },
});
