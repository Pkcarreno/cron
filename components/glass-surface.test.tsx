import { BlurTargetView, BlurView } from "expo-blur";
import React from "react";
import type { View } from "react-native";
import { Platform, StyleSheet } from "react-native";

import { Text } from "@/components/text";
import { colors } from "@/helpers/colors";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import { GLASS_SURFACE_DEFAULTS, GlassSurface } from "./glass-surface";

describe("expo-blur Jest mocks", () => {
  it("BlurView mock renders children and accepts layout styles", async () => {
    const screen = await renderWithProviders(
      <BlurView
        testID="mock-blur-view"
        style={testStyles.blurViewLayout}
        tint="dark"
        intensity={60}
      >
        <Text>BlurView Content</Text>
      </BlurView>
    );

    const blurView = screen.getByTestId("mock-blur-view");
    expect(blurView).toBeTruthy();
    expect(screen.getByText("BlurView Content")).toBeTruthy();

    const flatStyle = StyleSheet.flatten(blurView.props.style);
    expect(flatStyle.height).toBe(100);
    expect(flatStyle.width).toBe(200);
    expect(blurView.props.tint).toBe("dark");
    expect(blurView.props.intensity).toBe(60);
  });

  it("BlurTargetView mock renders children and accepts layout styles", async () => {
    const screen = await renderWithProviders(
      <BlurTargetView
        testID="mock-blur-target"
        style={testStyles.blurTargetLayout}
      >
        <Text>Target Content</Text>
      </BlurTargetView>
    );

    const blurTarget = screen.getByTestId("mock-blur-target");
    expect(blurTarget).toBeTruthy();
    expect(screen.getByText("Target Content")).toBeTruthy();

    const flatStyle = StyleSheet.flatten(blurTarget.props.style);
    expect(flatStyle.flex).toBe(1);
    expect(flatStyle.padding).toBe(12);
  });
});

describe("GlassSurface component", () => {
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = Platform.OS;
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatform,
    });
  });

  describe("rendering and children", () => {
    it("renders children elements properly", async () => {
      const screen = await renderWithProviders(
        <GlassSurface testID="glass-surface">
          <Text>Chrome Navigation Content</Text>
        </GlassSurface>
      );

      expect(screen.getByTestId("glass-surface")).toBeTruthy();
      expect(screen.getByText("Chrome Navigation Content")).toBeTruthy();
    });
  });

  describe("default parameters", () => {
    it("applies default tint, intensity, and bottom hairline border", async () => {
      const screen = await renderWithProviders(
        <GlassSurface testID="glass-surface" />
      );

      const surface = screen.getByTestId("glass-surface");
      expect(surface.props.tint).toBe(GLASS_SURFACE_DEFAULTS.tint);
      expect(surface.props.intensity).toBe(GLASS_SURFACE_DEFAULTS.intensity);

      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.overflow).toBe("hidden");
      expect(flatStyle.borderBottomWidth).toBe(StyleSheet.hairlineWidth);
      expect(flatStyle.borderBottomColor).toBe(
        GLASS_SURFACE_DEFAULTS.borderColor
      );
    });
  });

  describe("border treatments", () => {
    it("renders subtle hairline highlight on bottom edge with borderTreatment='bottom'", async () => {
      const screen = await renderWithProviders(
        <GlassSurface testID="glass-surface" borderTreatment="bottom" />
      );

      const surface = screen.getByTestId("glass-surface");
      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.borderBottomWidth).toBe(StyleSheet.hairlineWidth);
      expect(flatStyle.borderBottomColor).toBe(
        GLASS_SURFACE_DEFAULTS.borderColor
      );
      expect(flatStyle.borderWidth).toBeUndefined();
    });

    it("renders complete hairline highlight with borderTreatment='full'", async () => {
      const screen = await renderWithProviders(
        <GlassSurface testID="glass-surface" borderTreatment="full" />
      );

      const surface = screen.getByTestId("glass-surface");
      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.borderWidth).toBe(StyleSheet.hairlineWidth);
      expect(flatStyle.borderColor).toBe(GLASS_SURFACE_DEFAULTS.borderColor);
    });

    it("omits borders completely with borderTreatment='none'", async () => {
      const screen = await renderWithProviders(
        <GlassSurface testID="glass-surface" borderTreatment="none" />
      );

      const surface = screen.getByTestId("glass-surface");
      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.borderWidth).toBeUndefined();
      expect(flatStyle.borderBottomWidth).toBeUndefined();
    });

    it("applies custom highlight border color when specified", async () => {
      const customBorderColor = "rgba(255, 255, 255, 0.25)";
      const screen = await renderWithProviders(
        <GlassSurface
          testID="glass-surface"
          borderTreatment="full"
          borderColor={customBorderColor}
        />
      );

      const surface = screen.getByTestId("glass-surface");
      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.borderColor).toBe(customBorderColor);
    });
  });

  describe("style merging", () => {
    it("merges custom style object with base and border styling", async () => {
      const screen = await renderWithProviders(
        <GlassSurface testID="glass-surface" style={testStyles.surfaceCustom} />
      );

      const surface = screen.getByTestId("glass-surface");
      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.overflow).toBe("hidden");
      expect(flatStyle.borderRadius).toBe(24);
      expect(flatStyle.paddingHorizontal).toBe(16);
      expect(flatStyle.borderBottomWidth).toBe(StyleSheet.hairlineWidth);
    });

    it("merges style arrays correctly without dropping default properties", async () => {
      const screen = await renderWithProviders(
        <GlassSurface
          testID="glass-surface"
          style={[testStyles.marginPrimary, testStyles.marginSecondary]}
        />
      );

      const surface = screen.getByTestId("glass-surface");
      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.marginHorizontal).toBe(16);
      expect(flatStyle.overflow).toBe("hidden");
    });
  });

  describe("platform fallback behavior", () => {
    it("renders clean native blur parameters on iOS without forcing fallback overlay", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "ios",
      });

      const screen = await renderWithProviders(
        <GlassSurface testID="glass-surface" />
      );

      const surface = screen.getByTestId("glass-surface");
      expect(surface.props.tint).toBe("systemUltraThinMaterialDark");
      expect(surface.props.intensity).toBe(80);
      expect(surface.props.blurMethod).toBeUndefined();

      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.backgroundColor).toBeUndefined();
    });

    it("connects to target view with dimezisBlurViewSdk31Plus on Android when blurTarget is provided", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });

      const targetRef = { current: {} as React.ComponentRef<typeof View> };

      const screen = await renderWithProviders(
        <GlassSurface testID="glass-surface" blurTarget={targetRef} />
      );

      const surface = screen.getByTestId("glass-surface");
      expect(surface.props.blurMethod).toBe("dimezisBlurViewSdk31Plus");
      expect(surface.props.blurTarget).toBe(targetRef);

      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.backgroundColor).toBeUndefined();
    });

    it("falls back to clean translucent overlay on Android when blurTarget is absent", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });

      const screen = await renderWithProviders(
        <GlassSurface testID="glass-surface" />
      );

      const surface = screen.getByTestId("glass-surface");
      expect(surface.props.blurMethod).toBe("none");

      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.backgroundColor).toBe(colors.glassFallback);
    });

    it("respects explicit blurMethod='none' on Android and applies fallback overlay", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });

      const targetRef = { current: {} as React.ComponentRef<typeof View> };

      const screen = await renderWithProviders(
        <GlassSurface
          testID="glass-surface"
          blurTarget={targetRef}
          blurMethod="none"
        />
      );

      const surface = screen.getByTestId("glass-surface");
      expect(surface.props.blurMethod).toBe("none");

      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.backgroundColor).toBe(colors.glassFallback);
    });

    it("allows custom fallback background color", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });

      const customFallback = "rgba(10, 10, 10, 0.9)";

      const screen = await renderWithProviders(
        <GlassSurface
          testID="glass-surface"
          fallbackBackgroundColor={customFallback}
        />
      );

      const surface = screen.getByTestId("glass-surface");
      const flatStyle = StyleSheet.flatten(surface.props.style);
      expect(flatStyle.backgroundColor).toBe(customFallback);
    });
  });

  describe("custom parameters and prop forwarding", () => {
    it("allows custom tint and intensity", async () => {
      const screen = await renderWithProviders(
        <GlassSurface
          testID="glass-surface"
          tint="systemChromeMaterialDark"
          intensity={50}
        />
      );

      const surface = screen.getByTestId("glass-surface");
      expect(surface.props.tint).toBe("systemChromeMaterialDark");
      expect(surface.props.intensity).toBe(50);
    });

    it("forwards accessibility and pointerEvents props", async () => {
      const screen = await renderWithProviders(
        <GlassSurface
          testID="glass-surface"
          accessibilityLabel="Navigation Header Surface"
          pointerEvents="box-none"
        />
      );

      const surface = screen.getByTestId("glass-surface");
      expect(surface.props.accessibilityLabel).toBe(
        "Navigation Header Surface"
      );
      expect(surface.props.pointerEvents).toBe("box-none");
    });
  });
});

const testStyles = StyleSheet.create({
  blurTargetLayout: {
    flex: 1,
    padding: 12,
  },
  blurViewLayout: {
    height: 100,
    width: 200,
  },
  marginPrimary: {
    marginHorizontal: 8,
  },
  marginSecondary: {
    marginHorizontal: 16,
  },
  surfaceCustom: {
    borderRadius: 24,
    paddingHorizontal: 16,
  },
});
