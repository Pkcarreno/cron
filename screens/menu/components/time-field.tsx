import type { InputTimeProps } from "@/components/input-time";
import { InputTime } from "@/components/input-time";

export interface TimeFieldProps extends Omit<
  InputTimeProps,
  "value" | "onChange" | "onBlur"
> {
  value: number;
  onChange: (value: number) => void;
}

export const TimeField = ({ value, onChange, ...props }: TimeFieldProps) => (
  <InputTime value={value} onChange={onChange} {...props} />
);
