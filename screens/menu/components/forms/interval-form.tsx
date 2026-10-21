import { formOptions } from "@tanstack/form-core";
import { useAtom } from "jotai/react";
import { useCallback, useEffect } from "react";
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
import { IntervalPresetButton } from "@/screens/menu/components/preset-button";
import { intervalDefaults, intervalSchema } from "@/screens/menu/schema";
import { intervalWorkoutAtom } from "@/stores/workout";

import { useAppForm } from "./form-utils";

const intervalFormOpts = formOptions({
  defaultValues: intervalDefaults,
  validators: {
    onChange: intervalSchema,
  },
});

export interface IntervalFormProps {
  paddingBottom: number;
}

export const IntervalForm = ({ paddingBottom }: IntervalFormProps) => {
  const [interval, setInterval] = useAtom(intervalWorkoutAtom);

  const form = useAppForm({
    ...intervalFormOpts,
    defaultValues: interval,
  });

  useEffect(() => {
    form.validateSync("change");
    const subscription = form.store.subscribe(() => {
      setInterval((prev) => {
        const next = form.state.values;
        if (
          prev.restMs === next.restMs &&
          prev.totalRounds === next.totalRounds &&
          prev.workMs === next.workMs
        ) {
          return prev;
        }
        return next;
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [form, setInterval]);

  useEffect(() => {
    if (
      form.state.values.restMs !== interval.restMs ||
      form.state.values.totalRounds !== interval.totalRounds ||
      form.state.values.workMs !== interval.workMs
    ) {
      form.reset(interval);
      form.validateSync("change");
    }
  }, [interval, form]);

  const presetSelectors = useCallback(
    (state: typeof form.state) => ({
      restMs: state.values.restMs,
      totalRounds: state.values.totalRounds,
      workMs: state.values.workMs,
    }),
    []
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
                <form.Subscribe selector={presetSelectors}>
                  {({ workMs, restMs, totalRounds }) => (
                    <>
                      <Col>
                        <IntervalPresetButton
                          title="TABATA"
                          totalRounds={8}
                          workMs={20_000}
                          restMs={10_000}
                          disabled={
                            workMs === 20_000 &&
                            restMs === 10_000 &&
                            totalRounds === 8
                          }
                          setValue={form.setFieldValue}
                        />
                      </Col>
                      <Col>
                        <IntervalPresetButton
                          title='30" / 30"'
                          workMs={30_000}
                          restMs={30_000}
                          disabled={workMs === 30_000 && restMs === 30_000}
                          setValue={form.setFieldValue}
                        />
                      </Col>
                    </>
                  )}
                </form.Subscribe>
              </Row>
            </Grid>
          </Field>

          <form.AppField name="totalRounds">
            {(field) => (
              <Field>
                <FieldContent>
                  <FieldLabel>Rounds</FieldLabel>
                </FieldContent>
                <field.NumberField />
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
    </ScrollView>
  );
};
