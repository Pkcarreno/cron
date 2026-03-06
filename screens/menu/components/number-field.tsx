import type { InputProps } from '@/components/input';
import { Input } from '@/components/input';
import { useCallback } from 'react';
import { useFieldContext } from '@/screens/menu/form-context';

export const NumberField = (
  props: Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType' | 'onBlur'>
) => {
  const field = useFieldContext<number>();

  const handleChange = useCallback(
    (text: string) => {
      const num = Number.parseInt(text, 10);
      field.handleChange(Number.isNaN(num) ? 0 : num);
    },
    [field]
  );

  return (
    <Input
      value={field.state.value?.toString() ?? ''}
      onChangeText={handleChange}
      onBlur={field.handleBlur}
      keyboardType="number-pad"
      {...props}
    />
  );
};
