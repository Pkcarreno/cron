import type { ExpoConfig } from "@expo/config";
import { AndroidConfig, withAndroidManifest } from "@expo/config-plugins";

import Env from "../env";

export interface WithProfileableOptions {
  enabled?: boolean;
}

interface ProfileableElement {
  $: {
    "android:shell": string;
    [key: string]: string | undefined;
  };
}

interface ManifestApplicationWithProfileable extends Omit<
  AndroidConfig.Manifest.ManifestApplication,
  "$"
> {
  $?: Record<string, string | undefined>;
  profileable?: ProfileableElement[];
}

/**
 * Updates AndroidManifest.xml with or without the profileable tag.
 *
 * Android 10 (API level 29) and later blocks atrace, simpleperf, and Perfetto system
 * tracing in release builds unless `<profileable android:shell="true" />` is declared.
 * Adding this tag allows the ADB shell user to capture low-overhead production traces
 * and kernel CPU counters without activating debug mode overhead.
 *
 * In addition, `android:debuggable` must remain unset or false in production benchmarks.
 * Setting `android:debuggable="true"` disables ART Ahead-of-Time (AOT) optimizations,
 * forces JDWP thread initialization, alters Hermes garbage collection, and invalidates
 * benchmark determinism.
 *
 * @param androidManifest - The parsed AndroidManifest.xml object.
 * @param isEnabled - Whether the profileable tag should be present.
 * @returns The updated AndroidManifest object.
 */
export const setProfileableManifest = (
  androidManifest: AndroidConfig.Manifest.AndroidManifest,
  isEnabled: boolean
): AndroidConfig.Manifest.AndroidManifest => {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
    androidManifest
  ) as ManifestApplicationWithProfileable;

  mainApplication.$ ??= {};

  if (isEnabled) {
    const currentList = mainApplication.profileable ?? [];
    const hasShellProfileable = currentList.some(
      (item) => item.$?.["android:shell"] === "true"
    );

    if (!hasShellProfileable) {
      mainApplication.profileable = [
        ...currentList,
        {
          $: {
            "android:shell": "true",
          },
        },
      ];
    }

    if (mainApplication.$["android:debuggable"] === "true") {
      delete mainApplication.$["android:debuggable"];
    }
  } else if (mainApplication.profileable) {
    delete mainApplication.profileable;
  }

  return androidManifest;
};

/**
 * Injects `<profileable android:shell="true" />` into AndroidManifest.xml for preview builds.
 *
 * This configuration plugin enables non-intrusive performance profiling in production builds
 * using ADB shell-based profilers (such as Flashlight and Perfetto). It ensures the application
 * runs with full release optimizations while exposing kernel trace instrumentation to the host shell.
 *
 * @param config - The Expo project configuration object.
 * @param options - Plugin configuration options, including explicit override for enablement.
 * @returns The modified Expo configuration with AndroidManifest modifications applied.
 */
export const withProfileable = (
  config: ExpoConfig,
  options?: WithProfileableOptions
): ExpoConfig => {
  const isEnabled = options?.enabled ?? Env.EXPO_PUBLIC_APP_ENV === "preview";

  return withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = setProfileableManifest(
      manifestConfig.modResults,
      isEnabled
    );
    return manifestConfig;
  });
};

export default withProfileable;
