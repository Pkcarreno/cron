/* oxlint-disable react-native/no-unused-styles */
import { colors } from '@/helpers/colors';
import type { ViewStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from './text';

type ButtonVariant = 'primary' | 'secondary' | 'outline';
type ButtonSize = 'md' | 'sm';

interface ButtonProps extends React.ComponentProps<typeof Pressable> {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle;
}

const Button = ({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  size = 'md',
  style,
  ...rest
}: ButtonProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    {...rest}
    // oxlint-disable jsx-no-new-function-as-prop
    style={({ pressed }) => [
      styles.base,
      variantStyles[variant],
      sizeStyles[size],
      pressed && styles.pressed,
      pressed && !disabled && styles.shrink,
      disabled && styles.disabled,
      style,
    ]}
  >
    <Text
      style={[
        styles.text,
        variantStyles[`${variant}Text`],
        sizeStyles[`${size}TextSize`],
        disabled && styles.disabledText,
      ]}
    >
      {title}
    </Text>
  </Pressable>
);

export default Button;

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderColor: colors.transparent,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
  },
  disabled: {
    backgroundColor: colors.neutral[800],
    opacity: 0.7,
  },

  disabledText: {
    color: colors.neutral[200],
  },
  pressed: {
    opacity: 0.9,
  },
  shrink: {
    transform: [{ scale: 0.96 }],
  },
  text: {
    fontWeight: '600',
  },
});

const variantStyles = StyleSheet.create({
  outline: {
    backgroundColor: colors.transparent,
    borderColor: colors.neutral[500],
  },
  outlineText: {
    color: colors.neutral[200],
  },
  primary: {
    backgroundColor: colors.neutral[100],
  },
  primaryText: {
    color: colors.neutral[900],
  },
  secondary: {
    backgroundColor: colors.neutral[700],
  },
  secondaryText: {
    color: colors.neutral[300],
  },
});

const sizeStyles = StyleSheet.create({
  md: {
    padding: 24,
  },
  mdTextSize: {
    fontSize: 18,
  },
  sm: {
    padding: 12,
  },
  smTextSize: {
    fontSize: 16,
  },
});
