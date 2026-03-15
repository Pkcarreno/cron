import type { PressableProps, PressableStateCallbackType } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './text';
import { colors } from '@/helpers/colors';
import { useCallback, useMemo, useState } from 'react';
import Button from './button';
import InputThumbwheel from './input-thumbwheel';
import { z } from 'zod';
import { useField, useForm } from '@tanstack/react-form';
import { Sheet, SheetContent, SheetTrigger } from './sheet';

type onChangeValueType = (value: number) => void;

export interface InputNumberProps {
  value: number;
  onChangeValue?: onChangeValueType;
  editable?: PressableProps['disabled'];
  suffix?: string;
  valueSuffix?: string;
  min?: number;
  max?: number;
}

export const InputNumber: React.FC<InputNumberProps> = ({
  value,
  editable = true,
  suffix,
  ...props
}) => {
  const renderValue = useMemo(() => value.toString().padStart(2, '0'), [value]);

  const pressableStyles = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.pressable,
      !editable && styles.disabled,
      pressed && styles.pressed,
    ],
    [editable]
  );

  return (
    <NumberPickerSheet value={value} withoutTrigger {...props}>
      <View style={styles.container}>
        <SheetTrigger asChild>
          <Pressable style={pressableStyles} disabled={!editable}>
            <View style={styles.valueWrapper}>
              <Text
                color="white"
                weight="700"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.value}
              >
                {renderValue}
              </Text>
            </View>
          </Pressable>
        </SheetTrigger>
        <Text style={styles.suffix} size={16} colorSubtone="500" weight="300">
          {suffix}
        </Text>
      </View>
    </NumberPickerSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  disabled: {
    opacity: 0.7,
  },
  pressable: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: colors.neutral[800],
    borderColor: colors.neutral[600],
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.neutral[600],
  },
  suffix: {
    fontVariant: ['tabular-nums'],
    minWidth: 16,
  },
  value: {
    fontSize: 180,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
    width: '100%',
  },
  valueWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
});

export interface NumberPickerSheetProps
  extends
    React.PropsWithChildren,
    Pick<
      InputNumberProps,
      'value' | 'onChangeValue' | 'valueSuffix' | 'min' | 'max'
    > {
  withoutTrigger?: boolean;
}

export const NumberPickerSheet: React.FC<NumberPickerSheetProps> = ({
  children,
  onChangeValue,
  withoutTrigger = false,
  ...props
}) => {
  const [openSheet, setOpenSheet] = useState(false);

  const handleOnChange = useCallback<onChangeValueType>(
    (value) => {
      if (onChangeValue) {
        onChangeValue(value);
        setOpenSheet(false);
      }
    },
    [onChangeValue, setOpenSheet]
  );

  return (
    <Sheet open={openSheet} onOpenChange={setOpenSheet}>
      {withoutTrigger ? (
        children
      ) : (
        <SheetTrigger asChild>{children}</SheetTrigger>
      )}
      <SheetContent enableDynamicSizing={true} snapPoints={[]}>
        <NumberPickerForm onChangeValue={handleOnChange} {...props} />
      </SheetContent>
    </Sheet>
  );
};

const NumberPickerForm: React.FC<
  Pick<
    NumberPickerSheetProps,
    'value' | 'onChangeValue' | 'valueSuffix' | 'min' | 'max'
  >
> = ({ value, onChangeValue, valueSuffix, min = 0, max = 99 }) => {
  const form = useForm({
    defaultValues: {
      number: value,
    },
    onSubmit: (props) => {
      if (onChangeValue) {
        onChangeValue(props.value.number);
      }
    },
    validators: {
      onChange: z.object({
        number: z.number().min(min).max(max),
      }),
    },
  });

  const handleSubmit = useCallback(() => {
    form.handleSubmit();
  }, [form]);

  const numberField = useField({
    form,
    name: 'number',
  });

  const handleSubtractTen = useCallback(
    () => numberField.handleChange((prev) => prev - 10),
    [numberField]
  );

  const handleSubtractFive = useCallback(
    () => numberField.handleChange((prev) => prev - 5),
    [numberField]
  );

  const handleAddFive = useCallback(
    () => numberField.handleChange((prev) => prev + 5),
    [numberField]
  );

  const handleAddTen = useCallback(
    () => numberField.handleChange((prev) => prev + 10),
    [numberField]
  );

  return (
    <>
      <form.Field name="number">
        {(field) => {
          const currentValue = field.state.value;

          return (
            <>
              <View style={sheetFormStyles.header}>
                <Text
                  style={sheetFormStyles.value}
                  color="white"
                  weight="800"
                  size={48}
                >
                  {currentValue}
                </Text>
                {valueSuffix && (
                  <Text colorSubtone="500" weight="700" size={18}>
                    {valueSuffix}
                  </Text>
                )}
              </View>
              <View style={sheetFormStyles.content}>
                <View style={sheetFormStyles.inputWrapper}>
                  <InputThumbwheel
                    value={currentValue}
                    onChangeValue={field.handleChange}
                    min={min}
                    max={max}
                  />
                </View>
                <View style={sheetFormStyles.quickActionsRow}>
                  <View style={sheetFormStyles.quickActionGroup}>
                    <Button
                      title="-10"
                      variant="secondary"
                      size="sm"
                      disabled={currentValue - 10 < min}
                      onPress={handleSubtractTen}
                    />
                    <Button
                      title="-5"
                      variant="secondary"
                      size="sm"
                      disabled={currentValue - 5 < min}
                      onPress={handleSubtractFive}
                    />
                  </View>
                  <View style={sheetFormStyles.quickActionGroup}>
                    <Button
                      title="+5"
                      variant="secondary"
                      size="sm"
                      disabled={currentValue + 5 > max}
                      onPress={handleAddFive}
                    />
                    <Button
                      title="+10"
                      variant="secondary"
                      size="sm"
                      disabled={currentValue + 10 > max}
                      onPress={handleAddTen}
                    />
                  </View>
                </View>
              </View>
            </>
          );
        }}
      </form.Field>
      <View style={sheetFormStyles.footer}>
        <Button title="Save" onPress={handleSubmit} />
      </View>
    </>
  );
};

const sheetFormStyles = StyleSheet.create({
  content: {
    gap: 8,
  },
  footer: {},
  header: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  inputWrapper: {},
  quickActionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
});
