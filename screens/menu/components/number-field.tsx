import { useCallback } from 'react';
import { useFieldContext } from '@/screens/menu/form-context';
import type { InputNumberProps } from '@/components/input-number';
import { InputNumber } from '@/components/input-number';
import { Col, Grid, Row } from '@/components/grid';

export const NumberField = (
  props: Omit<InputNumberProps, 'value' | 'onChangeValue'>
) => {
  const field = useFieldContext<number>();

  const handleChange = useCallback(
    (value: number) => {
      field.handleChange(Number.isNaN(value) ? 0 : value);
    },
    [field]
  );

  return (
    <Grid columns={2} gap={12}>
      <Row>
        <Col span={1}>
          <InputNumber
            value={field.state.value}
            onChangeValue={handleChange}
            {...props}
          />
        </Col>
      </Row>
    </Grid>
  );
};
