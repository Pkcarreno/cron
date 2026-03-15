import { useCallback, useImperativeHandle } from 'react';
import type { Ref } from 'react';
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/field';
import { formOptions } from '@tanstack/form-core';
import { intervalDefaults, intervalSchema } from '@/screens/menu/schema';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import { useAppForm } from './form-utils';
import { ScrollView } from 'react-native';
import { Col, Grid, Row } from '@/components/grid';
import { IntervalPresetButton } from '@/screens/menu/components/preset-button';

const intervalFormOpts = formOptions({
  defaultValues: intervalDefaults,
  validators: {
    onSubmit: intervalSchema,
  },
});

interface IntervalFormProps {
  ref?: Ref<FormHandle>;
  onSubmit: (config: TimerConfig) => void;
}

export const IntervalForm = ({ onSubmit, ref }: IntervalFormProps) => {
  const form = useAppForm({
    ...intervalFormOpts,
    onSubmit: ({ value }) => {
      const config: TimerConfig = {
        mode: TimerMode.INTERVAL,
        restMs: value.restMs,
        totalRounds: value.totalRounds,
        workMs: value.workMs,
      };
      onSubmit(config);
    },
  });

  useImperativeHandle(ref, () => ({
    submit: () => {
      form.handleSubmit();
    },
  }));

  const presetSelectors = useCallback(
    (state: typeof form.state) => ({
      restMs: state.values.restMs,
      totalRounds: state.values.totalRounds,
      workMs: state.values.workMs,
    }),
    []
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
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
