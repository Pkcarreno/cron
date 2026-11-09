import { useCallback } from "react";

import { Col, Grid, Row } from "@/components/grid";
import type { InputNumberProps } from "@/components/input-number";
import { InputNumber } from "@/components/input-number";

export interface NumberFieldProps extends Omit<
  InputNumberProps,
  "value" | "onChange"
> {
  value: number;
  onChange: (value: number) => void;
}

export const NumberField = ({
  value,
  onChange,
  ...props
}: NumberFieldProps) => {
  const handleChange = useCallback(
    (nextValue: number) => {
      onChange(Number.isNaN(nextValue) ? 0 : nextValue);
    },
    [onChange]
  );

  return (
    <Grid columns={2} gap={12}>
      <Row>
        <Col span={1}>
          <InputNumber value={value} onChange={handleChange} {...props} />
        </Col>
      </Row>
    </Grid>
  );
};
