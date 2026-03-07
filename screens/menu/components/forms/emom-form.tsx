import { useImperativeHandle } from 'react';
import type { Ref } from 'react';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/field';
import { formOptions } from '@tanstack/form-core';
import {
  emomDefaults,
  emomSchema,
  DEFAULT_PREPARATION_MS,
} from '@/screens/menu/schema';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import { InputTime } from '@/components/input-time';
import { useAppForm } from './form-utils';
import { ScrollView } from 'react-native';

const emomFormOpts = formOptions({
  defaultValues: emomDefaults,
  validators: {
    onSubmit: emomSchema,
  },
});

interface EmomFormProps {
  ref?: Ref<FormHandle>;
  onSubmit: (config: TimerConfig) => void;
}

export const EmomForm = ({ onSubmit, ref }: EmomFormProps) => {
  const form = useAppForm({
    ...emomFormOpts,
    onSubmit: ({ value }) => {
      const config: TimerConfig = {
        mode: TimerMode.EMOM,
        preparationMs: DEFAULT_PREPARATION_MS,
        totalRounds: value.totalRounds,
      };
      onSubmit(config);
    },
  });

  useImperativeHandle(ref, () => ({
    submit: () => {
      form.handleSubmit();
    },
  }));

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <FieldSet>
        <FieldDescription>
          This is a round preset and can&apos;t be modified. To set custom round
          duration use the EVERY timer.
        </FieldDescription>
        <FieldGroup>
          <form.AppField name="totalRounds">
            {(field) => (
              <Field>
                <FieldLabel>Rounds</FieldLabel>
                <field.NumberField min={0} max={99} />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.AppField>

          <Field>
            <FieldLabel>Round duration</FieldLabel>
            <InputTime value={60 * 1000} editable={false} />
          </Field>
        </FieldGroup>
      </FieldSet>
    </ScrollView>
  );
};
