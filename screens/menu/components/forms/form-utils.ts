import { fieldContext, formContext } from '@/screens/menu/form-context';
import { createFormHook } from '@tanstack/react-form';
import { NumberField } from '@/screens/menu/components/number-field';
import { TimeField } from '@/screens/menu/components/time-field';

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    NumberField,
    TimeField,
  },
  fieldContext,
  formComponents: {},
  formContext,
});
