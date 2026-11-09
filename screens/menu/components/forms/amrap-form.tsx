import { useAtom } from "jotai/react";
import { useCallback, useMemo } from "react";
import { ScrollView } from "react-native";

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
  paddingBottom: number;
}

export const AmrapForm = ({ paddingBottom }: AmrapFormProps) => {
  const [amrap, setAmrap] = useAtom(amrapWorkoutAtom);

  const errors = useMemo(() => {
    const result = amrapSchema.safeParse(amrap);
    if (result.success) {
      return [];
    }
    return result.error.issues;
  }, [amrap]);

  const handleDurationChange = useCallback(
    (durationMs: number) => {
      setAmrap((prev) => ({ ...prev, durationMs }));
    },
    [setAmrap]
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom }}
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
