import { useAtom } from "jotai/react";
import { useCallback, useMemo } from "react";
import { ScrollView } from "react-native";
import * as v from "valibot";

import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/field";
import { TimeField } from "@/screens/menu/components/time-field";
import { amrapSchema } from "@/screens/menu/schema";
import { amrapWorkoutAtom } from "@/stores/workout";

export interface AmrapFormProps {
  paddingTop?: number;
  paddingBottom?: number;
}

export const AmrapForm = ({
  paddingTop = 0,
  paddingBottom = 0,
}: AmrapFormProps) => {
  const [amrap, setAmrap] = useAtom(amrapWorkoutAtom);

  const errors = useMemo(() => {
    const result = v.safeParse(amrapSchema, amrap);
    if (result.success) {
      return [];
    }
    return result.issues;
  }, [amrap]);

  const handleDurationChange = useCallback(
    (durationMs: number) => {
      setAmrap((prev) => ({ ...prev, durationMs }));
    },
    [setAmrap]
  );

  return (
    <ScrollView
      testID="amrap-form-scroll"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom,
        paddingTop,
      }}
      scrollIndicatorInsets={{
        bottom: paddingBottom,
        top: paddingTop,
      }}
    >
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldContent>
              <FieldLabel>Duration</FieldLabel>
            </FieldContent>
            <TimeField
              value={amrap.durationMs}
              onChange={handleDurationChange}
            />
            <FieldError errors={errors} />
          </Field>
        </FieldGroup>
      </FieldSet>
    </ScrollView>
  );
};
