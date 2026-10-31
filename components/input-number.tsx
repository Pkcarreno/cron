import { memo, useCallback, useMemo, useState } from "react";
import type {
  LayoutChangeEvent,
  PressableProps,
  PressableStateCallbackType,
} from "react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "@/helpers/colors";

import Button from "./button";
import InputThumbwheel from "./input-thumbwheel";
import type { TriggerRenderProp } from "./sheet";
import { Sheet, SheetContent, SheetTrigger } from "./sheet";
import { Text } from "./text";

type OnChangeValueType = (value: number) => void;

export interface InputNumberProps {
  value: number;
  onChange?: OnChangeValueType;
  onChangeValue?: OnChangeValueType;
  onCommitValue?: OnChangeValueType;
  editable?: PressableProps["disabled"];
  suffix?: string;
  valueSuffix?: string;
  min?: number;
  max?: number;
  testID?: string;
}

export const InputNumber: React.FC<InputNumberProps> = ({
  value,
  editable = true,
  suffix,
  testID,
  ...props
}) => {
  const renderValue = useMemo(() => value.toString().padStart(2, "0"), [value]);

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
          {(triggerProps) => (
            <Pressable
              testID={testID ?? "input-number-trigger"}
              collapsable={false}
              style={pressableStyles}
              disabled={!editable}
              {...triggerProps}
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
          )}
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
    alignItems: "flex-end",
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  disabled: {
    opacity: 0.7,
  },
  pressable: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: colors.neutral[800],
    borderColor: colors.neutral[600],
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.neutral[600],
  },
  suffix: {
    fontVariant: ["tabular-nums"],
    minWidth: 16,
  },
  value: {
    fontSize: 180,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    textAlign: "center",
    textAlignVertical: "center",
    width: "100%",
  },
  valueWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
});

type NumberPickerSheetBaseProps = Pick<
  InputNumberProps,
  | "value"
  | "onChange"
  | "onChangeValue"
  | "onCommitValue"
  | "valueSuffix"
  | "min"
  | "max"
>;

export type NumberPickerSheetProps = NumberPickerSheetBaseProps &
  (
    | {
        withoutTrigger?: false | undefined;
        children: TriggerRenderProp;
      }
    | {
        withoutTrigger: true;
        children?: React.ReactNode;
      }
  );

export const NumberPickerSheet: React.FC<NumberPickerSheetProps> = ({
  value,
  onChange,
  onChangeValue,
  onCommitValue,
  valueSuffix,
  min = 0,
  max = 99,
  ...props
}) => {
  const [openSheet, setOpenSheet] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setDraftValue(value);
      }
      setOpenSheet(isOpen);
    },
    [value]
  );

  const handleSave = useCallback(() => {
    onChange?.(draftValue);
    onChangeValue?.(draftValue);
    onCommitValue?.(draftValue);
    setOpenSheet(false);
  }, [draftValue, onChange, onChangeValue, onCommitValue]);

  return (
    <Sheet open={openSheet} onOpenChange={handleOpenChange}>
      {props.withoutTrigger ? (
        props.children
      ) : (
        <SheetTrigger asChild>{props.children}</SheetTrigger>
      )}
      <SheetContent enableDynamicSizing={true}>
        <NumberPickerForm
          value={draftValue}
          onChange={setDraftValue}
          onSave={handleSave}
          valueSuffix={valueSuffix}
          min={min}
          max={max}
        />
      </SheetContent>
    </Sheet>
  );
};

// Memoized direct value readout: 0ms overhead, perfectly synchronized with thumbwheel
const HeaderValueDisplay = memo(
  ({ value, suffix }: { value: number; suffix?: string }) => (
    <View style={sheetFormStyles.header}>
      <Text style={sheetFormStyles.value} color="white" weight="800" size={48}>
        {value}
      </Text>
      {suffix && (
        <Text
          style={sheetFormStyles.suffix}
          colorSubtone="500"
          weight="700"
          size={18}
        >
          {suffix}
        </Text>
      )}
    </View>
  )
);

HeaderValueDisplay.displayName = "HeaderValueDisplay";

const QuickActionsRow = memo(
  ({
    value,
    min,
    max,
    onChange,
  }: {
    value: number;
    min: number;
    max: number;
    onChange: (val: number) => void;
  }) => {
    const handleSubtractTen = useCallback(() => {
      onChange(Math.max(min, value - 10));
    }, [min, onChange, value]);

    const handleSubtractFive = useCallback(() => {
      onChange(Math.max(min, value - 5));
    }, [min, onChange, value]);

    const handleAddFive = useCallback(() => {
      onChange(Math.min(max, value + 5));
    }, [max, onChange, value]);

    const handleAddTen = useCallback(() => {
      onChange(Math.min(max, value + 10));
    }, [max, onChange, value]);

    return (
      <View style={sheetFormStyles.quickActionsRow}>
        <View style={sheetFormStyles.quickActionGroup}>
          <Button
            title="-10"
            variant="secondary"
            size="sm"
            disabled={value - 10 < min}
            onPress={handleSubtractTen}
          />
          <Button
            title="-5"
            variant="secondary"
            size="sm"
            disabled={value - 5 < min}
            onPress={handleSubtractFive}
          />
        </View>
        <View style={sheetFormStyles.quickActionGroup}>
          <Button
            title="+5"
            variant="secondary"
            size="sm"
            disabled={value + 5 > max}
            onPress={handleAddFive}
          />
          <Button
            title="+10"
            variant="secondary"
            size="sm"
            disabled={value + 10 > max}
            onPress={handleAddTen}
          />
        </View>
      </View>
    );
  }
);

QuickActionsRow.displayName = "QuickActionsRow";

export interface NumberPickerFormProps {
  /** Settled value of the picker. */
  value: number;
  /** Callback invoked when a value is committed (e.g. quick actions or thumbwheel settle). */
  onChange: (value: number) => void;
  /** Optional continuous integer change stream during active thumbwheel scroll. */
  onChangeValue?: (value: number) => void;
  /** Optional terminal event callback dispatched upon thumbwheel settle. */
  onCommitValue?: (value: number) => void;
  onSave?: () => void;
  valueSuffix?: string;
  min?: number;
  max?: number;
}

export const NumberPickerForm: React.FC<NumberPickerFormProps> = ({
  value,
  onChange,
  onChangeValue,
  onCommitValue,
  onSave,
  valueSuffix,
  min = 0,
  max = 99,
}) => {
  // Lock natural content height on initial mount to prevent TrueSheet requestLayout thrashing
  const [lockedHeight, setLockedHeight] = useState<number | undefined>();
  const [prevValue, setPrevValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setDisplayValue(value);
  }

  const handleContinuousChange = useCallback(
    (nextValue: number) => {
      setDisplayValue(nextValue);
      onChangeValue?.(nextValue);
    },
    [onChangeValue]
  );

  const handleCommit = useCallback(
    (nextValue: number) => {
      setDisplayValue(nextValue);
      onChange(nextValue);
      onCommitValue?.(nextValue);
    },
    [onChange, onCommitValue]
  );

  const handleContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (lockedHeight === undefined) {
        const { height } = e.nativeEvent.layout;
        if (height > 0) {
          setLockedHeight(Math.round(height));
        }
      }
    },
    [lockedHeight]
  );

  return (
    <View
      testID="number-picker-sheet"
      collapsable={false}
      onLayout={handleContainerLayout}
      style={[
        sheetFormStyles.root,
        lockedHeight ? { height: lockedHeight } : undefined,
      ]}
    >
      <HeaderValueDisplay value={displayValue} suffix={valueSuffix} />

      <View style={sheetFormStyles.content}>
        <View style={sheetFormStyles.inputWrapper}>
          <InputThumbwheel
            testID="thumbwheel-picker"
            value={value}
            onChangeValue={handleContinuousChange}
            onCommitValue={handleCommit}
            min={min}
            max={max}
          />
        </View>

        <QuickActionsRow
          value={value}
          min={min}
          max={max}
          onChange={handleCommit}
        />
      </View>
      <View style={sheetFormStyles.footer}>
        <Button
          testID="number-picker-save-button"
          title="Save"
          onPress={onSave}
        />
      </View>
    </View>
  );
};

const sheetFormStyles = StyleSheet.create({
  content: {
    gap: 8,
  },
  footer: {},
  header: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 8,
    height: 56,
    justifyContent: "center",
  },
  inputWrapper: {},
  quickActionGroup: {
    flexDirection: "row",
    gap: 8,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  root: {
    gap: 16,
  },
  suffix: {
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    lineHeight: 24,
  },
  value: {
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    lineHeight: 56,
  },
});
