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
import { IntervalPresetButton } from "@/screens/menu/components/preset-button";
import { TimeField } from "@/screens/menu/components/time-field";
import type { IntervalFormValues } from "@/screens/menu/schema";
import { intervalSchema } from "@/screens/menu/schema";
import { intervalWorkoutAtom } from "@/stores/workout";

export interface IntervalFormProps {
  paddingBottom: number;
}

export const IntervalForm = ({ paddingBottom }: IntervalFormProps) => {
  const [interval, setInterval] = useAtom(intervalWorkoutAtom);

  const errorsByField = useMemo(() => {
    const result = intervalSchema.safeParse(interval);
    const errors: Record<string, { message?: string }[]> = {
      restMs: [],
      totalRounds: [],
      workMs: [],
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
  }, [interval]);

  const handleTotalRoundsChange = useCallback(
    (totalRounds: number) => {
      setInterval((prev) => ({ ...prev, totalRounds }));
    },
    [setInterval]
  );

  const handleWorkMsChange = useCallback(
    (workMs: number) => {
      setInterval((prev) => ({ ...prev, workMs }));
    },
    [setInterval]
  );

  const handleRestMsChange = useCallback(
    (restMs: number) => {
      setInterval((prev) => ({ ...prev, restMs }));
    },
    [setInterval]
  );

  const handlePresetValueChange = useCallback(
    (field: keyof IntervalFormValues, value: number) => {
      setInterval((prev) => ({ ...prev, [field]: value }));
    },
    [setInterval]
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
                  <IntervalPresetButton
                    title="TABATA"
                    totalRounds={8}
                    workMs={20_000}
                    restMs={10_000}
                    disabled={
                      interval.workMs === 20_000 &&
                      interval.restMs === 10_000 &&
                      interval.totalRounds === 8
                    }
                    setValue={handlePresetValueChange}
                  />
                </Col>
                <Col>
                  <IntervalPresetButton
                    title='30" / 30"'
                    workMs={30_000}
                    restMs={30_000}
                    disabled={
                      interval.workMs === 30_000 && interval.restMs === 30_000
                    }
                    setValue={handlePresetValueChange}
                  />
                </Col>
              </Row>
            </Grid>
          </Field>

          <Field>
            <FieldContent>
              <FieldLabel>Rounds</FieldLabel>
            </FieldContent>
            <NumberField
              value={interval.totalRounds}
              onChange={handleTotalRoundsChange}
            />
            <FieldError errors={errorsByField.totalRounds} />
          </Field>

          <Field>
            <FieldContent>
              <FieldLabel>Work phase duration</FieldLabel>
            </FieldContent>
            <TimeField value={interval.workMs} onChange={handleWorkMsChange} />
            <FieldError errors={errorsByField.workMs} />
          </Field>

          <Field>
            <FieldContent>
              <FieldLabel>Rest phase duration</FieldLabel>
            </FieldContent>
            <TimeField value={interval.restMs} onChange={handleRestMsChange} />
            <FieldError errors={errorsByField.restMs} />
          </Field>
        </FieldGroup>
      </FieldSet>
    </ScrollView>
  );
};
