import { colors } from '@/helpers/colors';
import React, { useCallback } from 'react';
import type {
  ViewProps,
  PressableProps,
  PressableStateCallbackType,
} from 'react-native';
import { View, Pressable, StyleSheet } from 'react-native';
import type { TextProps } from './text';
import { Text } from './text';

export const Menu = ({ children, style, ...props }: ViewProps) => (
  <View style={[styles.list, style]} {...props}>
    {children}
  </View>
);

export const MenuTopic = ({ children, style, ...props }: TextProps) => {
  const colorProps = props.color
    ? props
    : { color: 'neutral', colorSubtone: '600', size: 13, ...props };

  return (
    <Text style={[styles.topic, style]} {...(colorProps as TextProps)}>
      {children}
    </Text>
  );
};

export const MenuGroup = ({ children, style, ...props }: ViewProps) => (
  <View style={[styles.group, style]} {...props}>
    {children}
  </View>
);

export const MenuItem = ({ children, style, ...props }: ViewProps) => (
  <Pressable style={[styles.item, style]} {...props}>
    {children}
  </Pressable>
);

export const MenuPressableItem = ({
  children,
  style,
  ...props
}: PressableProps) => {
  const pressableStyles = useCallback(
    ({ pressed, ...rest }: PressableStateCallbackType) => [
      styles.item,
      typeof style === 'function' ? style({ pressed, ...rest }) : style,
      pressed && styles.pressed,
    ],
    [style]
  );

  return (
    <Pressable style={pressableStyles} {...props}>
      {children}
    </Pressable>
  );
};

export const MenuItemText = ({ children, ...props }: TextProps) => {
  const colorProps = props.color
    ? props
    : { color: 'neutral', colorSubtone: '300', ...props };

  return <Text {...(colorProps as TextProps)}>{children}</Text>;
};

const styles = StyleSheet.create({
  group: {
    borderRadius: 12,
    gap: 2,
    overflow: 'hidden',
  },
  item: {
    alignItems: 'center',
    backgroundColor: colors.neutral[800],
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  list: {
    gap: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  topic: {
    paddingHorizontal: 12,
    textTransform: 'uppercase',
  },
});
