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

interface ManifestApplicationWithProfileable
  extends AndroidConfig.Manifest.ManifestApplication {
  profileable?: ProfileableElement[];
}

/**
 * Updates the AndroidManifest with or without the profileable tag.
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
 * Expo config plugin to inject `<profileable android:shell="true" />`
 * into AndroidManifest.xml for deterministic ADB profiling.
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
