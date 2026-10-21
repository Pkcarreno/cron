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
import { EmomPresetButton } from "@/screens/menu/components/preset-button";
import { emomDefaults, emomSchema } from "@/screens/menu/schema";
import { emomWorkoutAtom } from "@/stores/workout";

import { useAppForm } from "./form-utils";

const emomFormOpts = formOptions({
  defaultValues: emomDefaults,
  validators: {
    onChange: emomSchema,
  },
});

export interface EmomFormProps {
  paddingBottom: number;
}

export const EmomForm = ({ paddingBottom }: EmomFormProps) => {
  const [emom, setEmom] = useAtom(emomWorkoutAtom);

  const form = useAppForm({
    ...emomFormOpts,
    defaultValues: emom,
  });

  useEffect(() => {
    form.validateSync("change");
    const subscription = form.store.subscribe(() => {
      setEmom((prev) => {
        const next = form.state.values;
        if (
          prev.roundDurationMs === next.roundDurationMs &&
          prev.totalRounds === next.totalRounds
        ) {
          return prev;
        }
        return next;
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [form, setEmom]);

  useEffect(() => {
    if (
      form.state.values.roundDurationMs !== emom.roundDurationMs ||
      form.state.values.totalRounds !== emom.totalRounds
    ) {
      form.reset(emom);
      form.validateSync("change");
    }
  }, [emom, form]);

  const presetSelectors = useCallback(
    (state: typeof form.state) => ({
      roundDurationMs: state.values.roundDurationMs,
      totalRounds: state.values.totalRounds,
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
                  {({ roundDurationMs }) => (
                    <>
                      <Col>
                        <EmomPresetButton
                          title="1 min"
                          roundDurationMs={60_000}
                          disabled={roundDurationMs === 60_000}
                          setValue={form.setFieldValue}
                        />
                      </Col>
                      <Col>
                        <EmomPresetButton
                          title="45 sec"
                          roundDurationMs={45_000}
                          disabled={roundDurationMs === 45_000}
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
                <FieldLabel>Rounds</FieldLabel>
                <field.NumberField min={0} max={99} />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.AppField>

          <form.AppField name="roundDurationMs">
            {(field) => (
              <Field>
                <FieldContent>
                  <FieldLabel>Round Duration</FieldLabel>
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
