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
import { forTimeDefaults, forTimeSchema } from '@/screens/menu/schema';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import { useAppForm } from './form-utils';
import { ScrollView } from 'react-native';

const forTimeFormOpts = formOptions({
  defaultValues: forTimeDefaults,
  validators: {
    onSubmit: forTimeSchema,
  },
});

interface ForTimeFormProps {
  ref?: Ref<FormHandle>;
  paddingBottom: number;
  onSubmit: (config: TimerConfig) => void;
}

export const ForTimeForm = ({
  onSubmit,
  paddingBottom,
  ref,
}: ForTimeFormProps) => {
  const form = useAppForm({
    ...forTimeFormOpts,
    onSubmit: ({ value }) => {
      const config: TimerConfig = {
        mode: TimerMode.FOR_TIME,
        timecapMs: value.timecapMs,
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
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom }}
    >
      <FieldSet>
        <FieldGroup>
          <form.AppField name="timecapMs">
            {(field) => (
              <Field>
                <FieldContent>
                  <FieldLabel>Time Cap</FieldLabel>
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
