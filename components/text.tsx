import React from 'react';
import type { TextStyle } from 'react-native';
import { StyleSheet, Text as RNText } from 'react-native';
import { colors } from '@/helpers/colors';

type RNTextProps = React.ComponentProps<typeof RNText>;
type FontType = 'default' | 'mono';
type FontWeight =
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900';

type ThemeColors = typeof colors;
type AllColorKeys = keyof ThemeColors;

type ScaleColorKeys = {
  [K in AllColorKeys]: ThemeColors[K] extends string ? never : K;
}[AllColorKeys];

type SolidColorKeys = Exclude<AllColorKeys, ScaleColorKeys>;

interface DefaultColorProps {
  color?: 'neutral';
  colorSubtone?: `${keyof ThemeColors['neutral']}`;
}

type OtherScaleKeys = Exclude<ScaleColorKeys, 'neutral'>;
type OtherScaleProps = {
  [K in OtherScaleKeys]: {
    color: K;
    colorSubtone?: `${Extract<keyof ThemeColors['neutral'], string | number>}`;
  };
}[OtherScaleKeys];

interface SolidProps {
  color: SolidColorKeys;
  colorSubtone?: never;
}

export type TextProps = RNTextProps & {
  fontType?: FontType;
  weight?: FontWeight;
  size?: TextStyle['fontSize'];
} & (DefaultColorProps | OtherScaleProps | SolidProps);

export const Text = ({
  color = 'neutral',
  colorSubtone = '400',
  fontType = 'default',
  weight = '400',
  size,
  style,
  children,
  ...rest
}: TextProps) => {
  const colorValue = colors[color as AllColorKeys];

  const hexColor =
    typeof colorValue === 'string'
      ? colorValue
      : (colorValue as Record<string, string>)[colorSubtone];

  return (
    <RNText
      style={[
        styles.base,
        fontType === 'mono' && styles.mono,
        {
          color: hexColor,
          fontSize: size,
          fontWeight: weight,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    fontFamily: 'Geist',
  },
  mono: {
    fontFamily: 'Geist Mono',
  },
});
