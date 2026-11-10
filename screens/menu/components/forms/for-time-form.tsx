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
import { forTimeSchema } from "@/screens/menu/schema";
import { forTimeWorkoutAtom } from "@/stores/workout";

export interface ForTimeFormProps {
  paddingBottom: number;
}

export const ForTimeForm = ({ paddingBottom }: ForTimeFormProps) => {
  const [forTime, setForTime] = useAtom(forTimeWorkoutAtom);

  const errors = useMemo(() => {
    const result = v.safeParse(forTimeSchema, forTime);
    if (result.success) {
      return [];
    }
    return result.issues;
  }, [forTime]);

  const handleTimecapChange = useCallback(
    (timecapMs: number) => {
      setForTime((prev) => ({ ...prev, timecapMs }));
    },
    [setForTime]
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
              <FieldLabel>Time Cap</FieldLabel>
            </FieldContent>
            <TimeField
              value={forTime.timecapMs}
              onChange={handleTimecapChange}
            />
            <FieldError errors={errors} />
          </Field>
        </FieldGroup>
      </FieldSet>
    </ScrollView>
  );
};
