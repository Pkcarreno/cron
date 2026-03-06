import { useImperativeHandle } from 'react';
import type { Ref } from 'react';
import { formOptions } from '@tanstack/form-core';
import {
  tabataDefaults,
  tabataSchema,
  DEFAULT_PREPARATION_MS,
} from '@/screens/menu/schema';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/field';
import { Input } from '@/components/input';
import { InputTime } from '@/components/input-time';
import { useAppForm } from './form-utils';

const tabataFormOpts = formOptions({
  defaultValues: tabataDefaults,
  validators: {
    onSubmit: tabataSchema,
  },
});

interface TabataFormProps {
  ref?: Ref<FormHandle>;
  onSubmit: (config: TimerConfig) => void;
}

export const TabataForm = ({ onSubmit, ref }: TabataFormProps) => {
  const form = useAppForm({
    ...tabataFormOpts,
    onSubmit: ({ value }) => {
      const config: TimerConfig = {
        mode: TimerMode.TABATA,
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
    <FieldSet>
      <FieldDescription>
        This is an interval preset and can&apos;t be modified. For custom
        intervals use the ON/OFF timer.
      </FieldDescription>
      <FieldGroup>
        <Field>
          <FieldLabel>Rounds</FieldLabel>
          <Input value="8" editable={false} />
        </Field>

        <Field>
          <FieldLabel>Work phase duration</FieldLabel>
          <InputTime value={20 * 1000} editable={false} />
        </Field>

        <Field>
          <FieldLabel>Rest phase duration</FieldLabel>
          <InputTime value={10 * 1000} editable={false} />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
};
