import { StyleSheet, View } from 'react-native';
import type { InputProps } from './input';
import { Input } from './input';
import { Text } from './text';
import { useCallback, useMemo } from 'react';
import {
  convertTimeToMs,
  formatTimeForDisplay,
} from '@/helpers/timer/utils/formatter';

const MAX_MINUTES = 99;
const MAX_SECONDS = 59;

export interface InputTimeProps extends Omit<
  InputProps,
  'value' | 'onChangeText' | 'keyboardType' | 'maxLength'
> {
  value: number;
  onChangeValue?: (value: number) => void;
}

export const InputTime: React.FC<InputTimeProps> = ({
  style,
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
    (text: string) => {
      const num = Number.parseInt(text, 10);
      const clamped = Number.isNaN(num) ? 0 : Math.min(num, MAX_MINUTES);
      updateMs(clamped, seconds);
    },
    [seconds, updateMs]
  );

  const handleSecondsChange = useCallback(
    (text: string) => {
      const num = Number.parseInt(text, 10);
      const clamped = Number.isNaN(num) ? 0 : Math.min(num, MAX_SECONDS);
      updateMs(minutes, clamped);
    },
    [minutes, updateMs]
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <Input
          value={minutes.toString()}
          onChangeText={handleMinutesChange}
          keyboardType="number-pad"
          maxLength={2}
          style={[styles.input, style]}
          {...props}
        />
        <Text weight="200" size={16}>
          M
        </Text>
      </View>
      <View style={styles.inputWrapper}>
        <Input
          value={seconds.toString()}
          onChangeText={handleSecondsChange}
          keyboardType="number-pad"
          maxLength={2}
          style={[styles.input, style]}
          {...props}
        />
        <Text weight="200" size={16}>
          S
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    textAlign: 'center',
  },
  inputWrapper: {
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
});
