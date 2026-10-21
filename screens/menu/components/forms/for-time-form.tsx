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
import { forTimeDefaults, forTimeSchema } from "@/screens/menu/schema";
import { forTimeWorkoutAtom } from "@/stores/workout";

import { useAppForm } from "./form-utils";

const forTimeFormOpts = formOptions({
  defaultValues: forTimeDefaults,
  validators: {
    onChange: forTimeSchema,
  },
});

export interface ForTimeFormProps {
  paddingBottom: number;
}

export const ForTimeForm = ({ paddingBottom }: ForTimeFormProps) => {
  const [forTime, setForTime] = useAtom(forTimeWorkoutAtom);

  const form = useAppForm({
    ...forTimeFormOpts,
    defaultValues: forTime,
  });

  useEffect(() => {
    form.validateSync("change");
    const subscription = form.store.subscribe(() => {
      setForTime((prev) => {
        const next = form.state.values;
        if (prev.timecapMs === next.timecapMs) {
          return prev;
        }
        return next;
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [form, setForTime]);

  useEffect(() => {
    if (form.state.values.timecapMs !== forTime.timecapMs) {
      form.reset(forTime);
      form.validateSync("change");
    }
  }, [forTime, form]);

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
