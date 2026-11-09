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
import { Col, Grid, Row } from "@/components/grid";
import { NumberField } from "@/screens/menu/components/number-field";
import { EmomPresetButton } from "@/screens/menu/components/preset-button";
import { TimeField } from "@/screens/menu/components/time-field";
import type { EmomFormValues } from "@/screens/menu/schema";
import { emomSchema } from "@/screens/menu/schema";
import { emomWorkoutAtom } from "@/stores/workout";

export interface EmomFormProps {
  paddingBottom: number;
}

export const EmomForm = ({ paddingBottom }: EmomFormProps) => {
  const [emom, setEmom] = useAtom(emomWorkoutAtom);

  const errorsByField = useMemo(() => {
    const result = emomSchema.safeParse(emom);
    const errors: Record<string, { message?: string }[]> = {
      roundDurationMs: [],
      totalRounds: [],
    };
    if (!result.success) {
      for (const issue of result.error.issues) {
        const [path] = issue.path;
        if (typeof path === "string" && errors[path]) {
          errors[path].push(issue);
        }
      }
    }
    return errors;
  }, [emom]);

  const handleTotalRoundsChange = useCallback(
    (totalRounds: number) => {
      setEmom((prev) => ({ ...prev, totalRounds }));
    },
    [setEmom]
  );

  const handleRoundDurationChange = useCallback(
    (roundDurationMs: number) => {
      setEmom((prev) => ({ ...prev, roundDurationMs }));
    },
    [setEmom]
  );

  const handlePresetValueChange = useCallback(
    (field: keyof EmomFormValues, value: number) => {
      setEmom((prev) => ({ ...prev, [field]: value }));
    },
    [setEmom]
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
              <FieldLabel>Presets</FieldLabel>
            </FieldContent>
            <Grid columns={2} gap={12}>
              <Row>
                <Col>
                  <EmomPresetButton
                    title="1 min"
                    roundDurationMs={60_000}
                    disabled={emom.roundDurationMs === 60_000}
                    setValue={handlePresetValueChange}
                  />
                </Col>
                <Col>
                  <EmomPresetButton
                    title="45 sec"
                    roundDurationMs={45_000}
                    disabled={emom.roundDurationMs === 45_000}
                    setValue={handlePresetValueChange}
                  />
                </Col>
              </Row>
            </Grid>
          </Field>

          <Field>
            <FieldLabel>Rounds</FieldLabel>
            <NumberField
              min={0}
              max={99}
              value={emom.totalRounds}
              onChange={handleTotalRoundsChange}
            />
            <FieldError errors={errorsByField.totalRounds} />
          </Field>

          <Field>
            <FieldContent>
              <FieldLabel>Round Duration</FieldLabel>
            </FieldContent>
            <TimeField
              value={emom.roundDurationMs}
              onChange={handleRoundDurationChange}
            />
            <FieldError errors={errorsByField.roundDurationMs} />
          </Field>
        </FieldGroup>
      </FieldSet>
    </ScrollView>
  );
};
