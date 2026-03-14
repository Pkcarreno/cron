/* oxlint-disable react-native/no-unused-styles */
import { colors } from '@/helpers/colors';
import type {
  PressableProps,
  PressableStateCallbackType,
  ViewStyle,
} from 'react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from './text';
import { useCallback } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'md' | 'sm' | 'icon';

export interface IconProps {
  color: string;
  size: number;
}

interface BaseButtonProps extends Omit<PressableProps, 'title'> {
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle;
}

type ButtonContentProps =
  | { title: string; icon?: never }
  | { title?: string; icon: React.ComponentType<IconProps> };

export type ButtonProps = BaseButtonProps & ButtonContentProps;

const Button: React.FC<ButtonProps> = ({
  title,
  icon: Icon,
  onPress,
  disabled = false,
  variant = 'primary',
  size = 'md',
  style,
  ...rest
}) => {
  const pressableStyles = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.base,
      variantStyles[variant],
      sizeStyles[size],
      pressed && styles.pressed,
      pressed && !disabled && styles.shrink,
      disabled && styles.disabled,
      style,
    ],
    [variant, size, disabled, style]
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      {...rest}
      style={pressableStyles}
    >
      {Icon && (
        <Icon
          color={variantStyles[`${variant}Text`].color}
          size={sizeStyles[`${size}TextSize`].fontSize}
        />
      )}

      {title && (
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
      )}
    </Pressable>
  );
};

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
  ghost: {
    backgroundColor: colors.neutral[950],
  },
  ghostText: {
    color: colors.neutral[300],
  },
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
  icon: {
    padding: 12,
  },
  iconTextSize: {
    fontSize: 22,
  },
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
