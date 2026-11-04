import { useCallback } from "react";

import { Col, Grid, Row } from "@/components/grid";
import type { InputNumberProps } from "@/components/input-number";
import { InputNumber } from "@/components/input-number";
import { useFieldContext } from "@/screens/menu/form-context";

export const NumberField = (
  props: Omit<InputNumberProps, "value" | "onChange">
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
            onChange={handleChange}
            {...props}
          />
        </Col>
      </Row>
    </Grid>
  );
};
