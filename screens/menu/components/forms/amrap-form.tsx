import { formOptions } from "@tanstack/form-core";
import { useAtom } from "jotai/react";
import { useEffect } from "react";
import { ScrollView } from "react-native";

import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/field";
import { amrapDefaults, amrapSchema } from "@/screens/menu/schema";
import { amrapWorkoutAtom } from "@/stores/workout";

import { useAppForm } from "./form-utils";

const amrapFormOpts = formOptions({
  defaultValues: amrapDefaults,
  validators: {
    onChange: amrapSchema,
  },
});

export interface AmrapFormProps {
  paddingBottom: number;
}

export const AmrapForm = ({ paddingBottom }: AmrapFormProps) => {
  const [amrap, setAmrap] = useAtom(amrapWorkoutAtom);

  const form = useAppForm({
    ...amrapFormOpts,
    defaultValues: amrap,
  });

  useEffect(() => {
    form.validateSync("change");
    const subscription = form.store.subscribe(() => {
      setAmrap((prev) => {
        const next = form.state.values;
        if (prev.durationMs === next.durationMs) {
          return prev;
        }
        return next;
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [form, setAmrap]);

  useEffect(() => {
    if (form.state.values.durationMs !== amrap.durationMs) {
      form.reset(amrap);
      form.validateSync("change");
    }
  }, [amrap, form]);

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
