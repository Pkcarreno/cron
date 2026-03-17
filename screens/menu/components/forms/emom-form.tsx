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
import { emomDefaults, emomSchema } from '@/screens/menu/schema';
import type { FormHandle } from '@/screens/menu/schema';
import { TimerMode } from '@/helpers/timer/factory';
import type { TimerConfig } from '@/helpers/timer/factory';
import { useAppForm } from './form-utils';
import { ScrollView } from 'react-native';
import { Col, Grid, Row } from '@/components/grid';
import { EmomPresetButton } from '@/screens/menu/components/preset-button';

const emomFormOpts = formOptions({
  defaultValues: emomDefaults,
  validators: {
    onSubmit: emomSchema,
  },
});

interface EmomFormProps {
  ref?: Ref<FormHandle>;
  paddingBottom: number;
  onSubmit: (config: TimerConfig) => void;
}

export const EmomForm = ({ onSubmit, paddingBottom, ref }: EmomFormProps) => {
  const form = useAppForm({
    ...emomFormOpts,
    onSubmit: ({ value }) => {
      const config: TimerConfig = {
        mode: TimerMode.EMOM,
        roundDurationMs: value.roundDurationMs,
        totalRounds: value.totalRounds,
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
