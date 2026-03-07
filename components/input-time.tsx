import { useCallback, useMemo } from 'react';
import {
  convertTimeToMs,
  formatTimeForDisplay,
} from '@/helpers/timer/utils/formatter';
import { Col, Grid, Row } from './grid';
import type { InputNumberProps } from './input-number';
import { InputNumber } from './input-number';

const MAX_MINUTES = 99;
const MAX_SECONDS = 59;

export type InputTimeProps = InputNumberProps;

export const InputTime: React.FC<InputTimeProps> = ({
  value,
  onChangeValue,
  ...props
}) => {
  const { minutes, seconds } = useMemo(() => {
    const segregatedTimeInString = formatTimeForDisplay(value);

    return {
      minutes: Number.parseInt(segregatedTimeInString.minutes, 10),
      seconds: Number.parseInt(segregatedTimeInString.seconds, 10),
    };
  }, [value]);

  const updateMs = useCallback(
    (newMinutes: number, newSeconds: number) => {
      onChangeValue?.(convertTimeToMs(newMinutes, newSeconds));
    },
    [onChangeValue]
  );

  const handleMinutesChange = useCallback(
    (newValue: number) => {
      const clamped = Number.isNaN(newValue)
        ? 0
        : Math.min(newValue, MAX_MINUTES);
      updateMs(clamped, seconds);
    },
    [seconds, updateMs]
  );

  const handleSecondsChange = useCallback(
    (newValue: number) => {
      const clamped = Number.isNaN(newValue)
        ? 0
        : Math.min(newValue, MAX_SECONDS);
      updateMs(minutes, clamped);
    },
    [minutes, updateMs]
  );

  return (
    <Grid columns={2} gap={12}>
      <Row>
        <Col span={1}>
          <InputNumber
            value={minutes}
            onChangeValue={handleMinutesChange}
            suffix="M"
            valueSuffix="min"
            min={0}
            max={MAX_MINUTES}
            {...props}
          />
        </Col>
        <Col span={1}>
          <InputNumber
            value={seconds}
            onChangeValue={handleSecondsChange}
            suffix="S"
            valueSuffix="sec"
            min={0}
            max={MAX_SECONDS}
            {...props}
          />
        </Col>
      </Row>
    </Grid>
  );
};
