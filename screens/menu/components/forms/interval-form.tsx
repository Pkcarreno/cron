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
  intervalDefaults,
  intervalSchema,
  DEFAULT_PREPARATION_MS,
} from '@/screens/menu/schema';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import { useAppForm } from './form-utils';
import { ScrollView } from 'react-native';

const intervalFormOpts = formOptions({
  defaultValues: intervalDefaults,
  validators: {
    onSubmit: intervalSchema,
  },
});

interface IntervalFormProps {
  ref?: Ref<FormHandle>;
  onSubmit: (config: TimerConfig) => void;
}

export const IntervalForm = ({ onSubmit, ref }: IntervalFormProps) => {
  const form = useAppForm({
    ...intervalFormOpts,
    onSubmit: ({ value }) => {
      const config: TimerConfig = {
        mode: TimerMode.INTERVAL,
        preparationMs: DEFAULT_PREPARATION_MS,
        restMs: value.restMs,
        totalRounds: value.totalRounds,
        workMs: value.workMs,
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
                <FieldContent>
                  <FieldLabel>Rounds</FieldLabel>
                </FieldContent>
                <field.NumberField />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.AppField>

          <form.AppField name="workMs">
            {(field) => (
              <Field>
                <FieldContent>
                  <FieldLabel>Work phase duration</FieldLabel>
                </FieldContent>
                <field.TimeField />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.AppField>

          <form.AppField name="restMs">
            {(field) => (
              <Field>
                <FieldContent>
                  <FieldLabel>Rest phase duration</FieldLabel>
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
