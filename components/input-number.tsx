import type { PressableProps, PressableStateCallbackType } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './text';
import { colors } from '@/helpers/colors';
import { useCallback, useMemo, useRef } from 'react';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './button';
import InputThumbwheel from './input-thumbwheel';
import { z } from 'zod';
import { useField, useForm } from '@tanstack/react-form';

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
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const renderValue = useMemo(() => value.toString().padStart(2, '0'), [value]);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present(0);
  }, []);

  const pressableStyles = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.pressable,
      !editable && styles.disabled,
      pressed && styles.pressed,
    ],
    [editable]
  );

  return (
    <>
      <View style={styles.container}>
        <Pressable
          style={pressableStyles}
          onPress={handlePresentModalPress}
          disabled={!editable}
        >
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
        <Text style={styles.suffix} size={16} colorSubtone="500" weight="300">
          {suffix}
        </Text>
      </View>
      <SheetContent
        value={value}
        sheetModalRef={bottomSheetModalRef}
        {...props}
      />
    </>
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

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
    pressBehavior="close"
  />
);

interface SheetContentProps extends Pick<
  InputNumberProps,
  'value' | 'onChangeValue' | 'valueSuffix' | 'min' | 'max'
> {
  sheetModalRef: React.RefObject<BottomSheetModal | null>;
}

const SheetContent: React.FC<SheetContentProps> = ({
  sheetModalRef,
  ...props
}) => {
  const { bottom } = useSafeAreaInsets();

  const bottomSheetViewStyles = useMemo(
    () => ({
      paddingBottom: bottom + 16,
    }),
    [bottom]
  );

  return (
    <BottomSheetModal
      ref={sheetModalRef}
      index={0}
      enableDynamicSizing={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={sheetStyles.background}
      handleIndicatorStyle={sheetStyles.indicator}
    >
      <BottomSheetView style={[sheetStyles.container, bottomSheetViewStyles]}>
        <SheetForm sheetModalRef={sheetModalRef} {...props} />
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const sheetStyles = StyleSheet.create({
  background: {
    backgroundColor: colors.neutral[800],
    borderRadius: 24,
  },
  container: {
    flex: 1,
    gap: 16,
    paddingHorizontal: 20,
  },
  indicator: {
    backgroundColor: colors.neutral[600],
    height: 5,
    width: 40,
  },
});

const SheetForm: React.FC<
  Pick<
    SheetContentProps,
    'sheetModalRef' | 'value' | 'onChangeValue' | 'valueSuffix' | 'min' | 'max'
  >
> = ({
  sheetModalRef,
  value,
  onChangeValue,
  valueSuffix,
  min = 0,
  max = 99,
}) => {
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
    try {
      form.handleSubmit();
    } finally {
      sheetModalRef.current?.dismiss();
    }
  }, [form, sheetModalRef]);

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
