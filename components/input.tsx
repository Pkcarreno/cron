import { colors } from '@/helpers/colors';
import { StyleSheet, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';

export type InputProps = TextInputProps & React.RefAttributes<TextInput>;

export const Input = ({ style, ...props }: InputProps) => (
  <TextInput
    style={[styles.input, props.editable === false && styles.disabled, style]}
    cursorColor={colors.neutral[200]}
    placeholderTextColor={colors.neutral[500]}
    {...props}
  />
);

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.7,
  },
  input: {
    backgroundColor: colors.neutral[800],
    borderColor: colors.neutral[600],
    borderRadius: 12,
    borderWidth: 1,
    color: colors.neutral[300],
    fontSize: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
