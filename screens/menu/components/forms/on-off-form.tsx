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
  onOffDefaults,
  onOffSchema,
  DEFAULT_PREPARATION_MS,
} from '@/screens/menu/schema';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import { useAppForm } from './form-utils';

const onOffFormOpts = formOptions({
  defaultValues: onOffDefaults,
  validators: {
    onSubmit: onOffSchema,
  },
});

interface OnOffFormProps {
  ref?: Ref<FormHandle>;
  onSubmit: (config: TimerConfig) => void;
}

export const OnOffForm = ({ onSubmit, ref }: OnOffFormProps) => {
  const form = useAppForm({
    ...onOffFormOpts,
    onSubmit: ({ value }) => {
      const config: TimerConfig = {
        mode: TimerMode.ON_OFF,
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
  );
};
