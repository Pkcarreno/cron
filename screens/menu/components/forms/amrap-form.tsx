import { formOptions } from "@tanstack/form-core";
import { useImperativeHandle } from "react";
import type { Ref } from "react";
import { ScrollView } from "react-native";

import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/field";
import { TimerMode } from "@/helpers/timer/factory";
import type { TimerConfig } from "@/helpers/timer/factory";
import { amrapDefaults, amrapSchema } from "@/screens/menu/schema";
import type { FormHandle } from "@/screens/menu/schema";

import { useAppForm } from "./form-utils";

const amrapFormOpts = formOptions({
  defaultValues: amrapDefaults,
  validators: {
    onSubmit: amrapSchema,
  },
});

interface AmrapFormProps {
  ref?: Ref<FormHandle>;
  paddingBottom: number;
  onSubmit: (config: TimerConfig) => void;
}

export const AmrapForm = ({ onSubmit, paddingBottom, ref }: AmrapFormProps) => {
  const form = useAppForm({
    ...amrapFormOpts,
    onSubmit: ({ value }) => {
      const config: TimerConfig = {
        durationMs: value.durationMs,
        mode: TimerMode.AMRAP,
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
          <form.AppField name="durationMs">
            {(field) => (
              <Field>
                <FieldContent>
                  <FieldLabel>Duration</FieldLabel>
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
