import React from "react";
import type { TextStyle } from "react-native";
import { StyleSheet, Text as RNText } from "react-native";

import { colors } from "@/helpers/colors";

type RNTextProps = React.ComponentProps<typeof RNText>;
export type FontType = "default" | "mono";

export type DefaultFontWeight =
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800";

export type MonoFontWeight = "300" | "400" | "800";

export type FontWeight<T extends FontType = "default"> = T extends "mono"
  ? MonoFontWeight
  : DefaultFontWeight;

type ThemeColors = typeof colors;
type AllColorKeys = keyof ThemeColors;

type ScaleColorKeys = {
  [K in AllColorKeys]: ThemeColors[K] extends string ? never : K;
}[AllColorKeys];

type SolidColorKeys = Exclude<AllColorKeys, ScaleColorKeys>;

interface DefaultColorProps {
  color?: "neutral";
  colorSubtone?: `${keyof ThemeColors["neutral"]}`;
}

type OtherScaleKeys = Exclude<ScaleColorKeys, "neutral">;
type OtherScaleProps = {
  [K in OtherScaleKeys]: {
    color: K;
    colorSubtone?: `${Extract<keyof ThemeColors["neutral"], string | number>}`;
  };
}[OtherScaleKeys];

interface SolidProps {
  color: SolidColorKeys;
  colorSubtone?: never;
}

export type TextProps<T extends FontType = "default"> = RNTextProps & {
  fontType?: T;
  weight?: FontWeight<T>;
  size?: TextStyle["fontSize"];
} & (DefaultColorProps | OtherScaleProps | SolidProps);

export const Text = <T extends FontType = "default">({
  color = "neutral",
  colorSubtone = "400",
  fontType = "default" as T,
  weight = "400" as FontWeight<T>,
  size,
  style,
  children,
  ...rest
}: TextProps<T>) => {
  const colorValue = colors[color as AllColorKeys];

  const hexColor =
    typeof colorValue === "string"
      ? colorValue
      : (colorValue as Record<string, string>)[colorSubtone];

  return (
    <RNText
      style={[
        styles.base,
        fontType === "mono" && styles.mono,
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
    fontFamily: "Geist",
  },
  mono: {
    fontFamily: "Geist Mono",
  },
});
