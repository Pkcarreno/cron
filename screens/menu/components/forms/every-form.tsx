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
  everyDefaults,
  everySchema,
  DEFAULT_PREPARATION_MS,
} from '@/screens/menu/schema';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import { useAppForm } from './form-utils';

const everyFormOpts = formOptions({
  defaultValues: everyDefaults,
  validators: {
    onSubmit: everySchema,
  },
});

interface EveryFormProps {
  ref?: Ref<FormHandle>;
  onSubmit: (config: TimerConfig) => void;
}

export const EveryForm = ({ onSubmit, ref }: EveryFormProps) => {
  const form = useAppForm({
    ...everyFormOpts,
    onSubmit: ({ value }) => {
      const config: TimerConfig = {
        mode: TimerMode.EVERY,
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
    <FieldSet>
      <FieldGroup>
        <form.AppField name="totalRounds">
          {(field) => (
            <Field>
              <FieldContent>
                <FieldLabel>Rounds</FieldLabel>
              </FieldContent>
              <field.NumberField placeholder="e.g. 3" />
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
  );
};
