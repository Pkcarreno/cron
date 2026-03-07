import type { InputTimeProps } from '@/components/input-time';
import { InputTime } from '@/components/input-time';
import { useFieldContext } from '@/screens/menu/form-context';

type TimeFieldProps = Omit<
  InputTimeProps,
  'value' | 'onChangeValue' | 'onBlur'
>;
export const TimeField = (props: TimeFieldProps) => {
  const field = useFieldContext<number>();

  return (
    <InputTime
      value={field.state.value}
      onChangeValue={field.handleChange}
      {...props}
    />
  );
};
