import { useImperativeHandle } from 'react';
import type { Ref } from 'react';
import {
  Field,
  FieldContent,
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
        roundDurationMs: value.roundDurationMs,
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

          <form.AppField name="roundDurationMs">
            {(field) => (
              <Field>
                <FieldContent>
                  <FieldLabel>Round Duration</FieldLabel>
                </FieldContent>
                <field.TimeField />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.AppField>
        </FieldGroup>
      </FieldSet>
    </ScrollView>
  );
};
