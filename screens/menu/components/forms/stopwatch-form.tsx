import { useImperativeHandle } from 'react';
import type { Ref } from 'react';
import { DEFAULT_PREPARATION_MS } from '@/screens/menu/schema';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import { FieldDescription, FieldSet } from '@/components/field';
import { ScrollView } from 'react-native';

interface StopWatchFormProps {
  ref?: Ref<FormHandle>;
  onSubmit: (config: TimerConfig) => void;
}

export const StopWatchForm = ({ onSubmit, ref }: StopWatchFormProps) => {
  useImperativeHandle(ref, () => ({
    submit: () => {
      const config: TimerConfig = {
        mode: TimerMode.STOP_WATCH,
        preparationMs: DEFAULT_PREPARATION_MS,
      };
      onSubmit(config);
    },
  }));

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <FieldSet>
        <FieldDescription>
          This timer will run indefinitely until you stop it. Long press the
          screen to finish and see your session summary.
        </FieldDescription>
      </FieldSet>
    </ScrollView>
  );
};
