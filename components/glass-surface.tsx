import type { BlurMethod, BlurTint, BlurViewProps } from "expo-blur";
import { BlurView } from "expo-blur";
import React from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { Platform, StyleSheet } from "react-native";

import { colors } from "@/helpers/colors";

/**
 * Hairline border treatment options for the glass surface.
 * - `bottom`: Render a subtle hairline border on the bottom edge.
 * - `full`: Render a subtle hairline border around all edges.
 * - `none`: Render no highlight border.
 */
export type GlassBorderTreatment = "bottom" | "full" | "none";

export interface GlassSurfaceProps extends Omit<ViewProps, "ref"> {
  children?: React.ReactNode;
  /**
   * Blur tint effect applied by native visual effect view.
   * @default "systemUltraThinMaterialDark"
   */
  tint?: BlurTint;
  /**
   * Blur intensity percentage (1 to 100).
   * @default 80
   */
  intensity?: number;
  /**
   * Target view reference for Android hardware blur rendering.
   */
  blurTarget?: BlurViewProps["blurTarget"];
  /**
   * Android blur rendering method.
   * Defaults to "dimezisBlurViewSdk31Plus" when blurTarget is provided,
   * falling back to "none" when no target view is configured.
   */
  blurMethod?: BlurMethod;
  /**
   * Hairline highlight border position.
   * @default "bottom"
   */
  borderTreatment?: GlassBorderTreatment;
  /**
   * Border color for the highlight treatment.
   * @default colors.glassBorder
   */
  borderColor?: string;
  /**
   * Fallback background color applied during platform fallback (e.g. Android without hardware blur target).
   * @default colors.glassFallback
   */
  fallbackBackgroundColor?: string;
  /**
   * Optional ref forwarded to underlying BlurView component.
   */
  ref?: React.Ref<React.ComponentRef<typeof BlurView>>;
}

export const GLASS_SURFACE_DEFAULTS = {
  borderColor: colors.glassBorder,
  borderTreatment: "bottom" as GlassBorderTreatment,
  fallbackBackgroundColor: colors.glassFallback,
  intensity: 80,
  tint: "systemUltraThinMaterialDark" as BlurTint,
} as const;

/**
 * Resolve border styling according to the selected border treatment.
 */
const resolveBorderStyles = (
  treatment: GlassBorderTreatment,
  borderColor: string
): ViewStyle => {
  switch (treatment) {
    case "bottom": {
      return {
        borderBottomColor: borderColor,
        borderBottomWidth: StyleSheet.hairlineWidth,
      };
    }
    case "full": {
      return {
        borderColor,
        borderWidth: StyleSheet.hairlineWidth,
      };
    }
    case "none": {
      return {};
    }
    default: {
      return {};
    }
  }
};

/**
 * Resolve the Android blur method, selecting hardware blur when target exists
 * or falling back gracefully to clean translucent overlay.
 */
const resolveBlurMethod = (
  platform: typeof Platform.OS,
  blurTarget?: BlurViewProps["blurTarget"],
  explicitMethod?: BlurMethod
): BlurMethod | undefined => {
  if (platform !== "android") {
    return explicitMethod;
  }
  if (explicitMethod) {
    return explicitMethod;
  }
  return blurTarget ? "dimezisBlurViewSdk31Plus" : "none";
};

/**
 * Reusable translucent glass surface component.
 *
 * Encapsulates native blur effect on iOS (`systemUltraThinMaterialDark`, 80% intensity)
 * and real-time hardware blur on Android 12+ via `dimezisBlurViewSdk31Plus` connected
 * to a target view. Falls back gracefully to a clean translucent overlay on older Android devices
 * or when no blur target is provided.
 */
export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  tint = GLASS_SURFACE_DEFAULTS.tint,
  intensity = GLASS_SURFACE_DEFAULTS.intensity,
  blurTarget,
  blurMethod,
  borderTreatment = GLASS_SURFACE_DEFAULTS.borderTreatment,
  borderColor = GLASS_SURFACE_DEFAULTS.borderColor,
  fallbackBackgroundColor = GLASS_SURFACE_DEFAULTS.fallbackBackgroundColor,
  style,
  ref,
  ...restProps
}) => {
  const resolvedBlurMethod = resolveBlurMethod(
    Platform.OS,
    blurTarget,
    blurMethod
  );

  const isAndroidFallback =
    Platform.OS === "android" && (resolvedBlurMethod === "none" || !blurTarget);

  const borderStyle = resolveBorderStyles(borderTreatment, borderColor);
  const fallbackStyle: ViewStyle | undefined = isAndroidFallback
    ? { backgroundColor: fallbackBackgroundColor }
    : undefined;

  const combinedStyles: StyleProp<ViewStyle> = [
    styles.base,
    borderStyle,
    fallbackStyle,
    style,
  ];

  return (
    <BlurView
      ref={ref}
      tint={tint}
      intensity={intensity}
      blurTarget={blurTarget}
      blurMethod={resolvedBlurMethod}
      style={combinedStyles}
      {...restProps}
    >
      {children}
    </BlurView>
  );
};

export default GlassSurface;

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
});
