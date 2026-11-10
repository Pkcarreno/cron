import type { ConfigContext, ExpoConfig } from "@expo/config";
import "tsx/cjs";

import Env from "./env";

const getAppIconsData = (
  appEnv: typeof Env.EXPO_PUBLIC_APP_ENV
): {
  icon: string;
  ios: {
    icon: {
      dark: string;
      light: string;
      tinted: string;
    };
  };
  android: {
    adaptiveIcon: {
      backgroundColor: string;
    };
  };
  web: {
    favicon: string;
  };
} => {
  if (appEnv === "production") {
    return {
      android: {
        adaptiveIcon: {
          backgroundColor: "#000000",
        },
      },
      icon: "./assets/icon.png",
      ios: {
        icon: {
          dark: "./assets/ios-dark.png",
          light: "./assets/ios-light.png",
          tinted: "./assets/ios-tinted.png",
        },
      },
      web: {
        favicon: "./assets/favicon.png",
      },
    };
  }

  if (appEnv === "preview") {
    return {
      android: {
        adaptiveIcon: {
          backgroundColor: "#E7801F",
        },
      },
      icon: "./assets/icon-preview.png",
      ios: {
        icon: {
          dark: "./assets/ios-dark-preview.png",
          light: "./assets/ios-light-preview.png",
          tinted: "./assets/ios-tinted-preview.png",
        },
      },
      web: {
        favicon: "./assets/favicon-preview.png",
      },
    };
  }

  return {
    android: {
      adaptiveIcon: {
        backgroundColor: "#008153",
      },
    },
    icon: "./assets/icon-dev.png",
    ios: {
      icon: {
        dark: "./assets/ios-dark-dev.png",
        light: "./assets/ios-light-dev.png",
        tinted: "./assets/ios-tinted-dev.png",
      },
    },
    web: {
      favicon: "./assets/favicon-dev.png",
    },
  };
};

const appIconsData = getAppIconsData(Env.EXPO_PUBLIC_APP_ENV);

const appConfig = ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  android: {
    adaptiveIcon: {
      backgroundColor: appIconsData.android.adaptiveIcon.backgroundColor,
      foregroundImage: "./assets/adaptive-icon.png",
    },
    backgroundColor: "#000000",
    blockedPermissions:
      Env.EXPO_PUBLIC_APP_ENV === "development"
        ? []
        : ["android.permission.INTERNET"],
    package: Env.EXPO_PUBLIC_PACKAGE,
    permissions: [
      "android.permission.VIBRATE",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_HEALTH",
      "android.permission.HIGH_SAMPLING_RATE_SENSORS",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.WAKE_LOCK",
      "android.permission.POST_PROMOTED_NOTIFICATIONS",
    ],
    predictiveBackGestureEnabled: true,
    versionCode: Env.EXPO_PUBLIC_BUILD_NUMBER,
  },
  backgroundColor: "#000000",
  description: "Hiit Timer App",
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "db7b2cae-63b8-458a-b91c-e4c9a596b7b1",
    },
  },
  icon: appIconsData.icon,
  ios: {
    backgroundColor: "#000000",
    buildNumber: Env.EXPO_PUBLIC_BUILD_NUMBER.toString(),
    bundleIdentifier: Env.EXPO_PUBLIC_BUNDLE_ID,
    icon: appIconsData.ios.icon,
    supportsTablet: true,
  },
  name: Env.EXPO_PUBLIC_NAME,
  orientation: "portrait",
  owner: "pkcarreno",
  plugins: [
    "expo-router",
    [
      "expo-font",
      {
        android: {
          fonts: [
            {
              fontDefinitions: [
                {
                  path: "./assets/fonts/Geist-ExtraLight.ttf",
                  weight: 200,
                },
                {
                  path: "./assets/fonts/Geist-Light.ttf",
                  weight: 300,
                },
                {
                  path: "./assets/fonts/Geist-Regular.ttf",
                  weight: 400,
                },
                {
                  path: "./assets/fonts/Geist-Medium.ttf",
                  weight: 500,
                },
                {
                  path: "./assets/fonts/Geist-SemiBold.ttf",
                  weight: 600,
                },
                {
                  path: "./assets/fonts/Geist-Bold.ttf",
                  weight: 700,
                },
                {
                  path: "./assets/fonts/Geist-ExtraBold.ttf",
                  weight: 800,
                },
              ],
              fontFamily: "Geist",
            },
            {
              fontDefinitions: [
                {
                  path: "./assets/fonts/GeistMono-Light.ttf",
                  weight: 300,
                },
                {
                  path: "./assets/fonts/GeistMono-Regular.ttf",
                  weight: 400,
                },
                {
                  path: "./assets/fonts/GeistMono-ExtraBold.ttf",
                  weight: 800,
                },
              ],
              fontFamily: "Geist Mono",
            },
          ],
        },
        fonts: [
          "./assets/fonts/Geist-Bold.ttf",
          "./assets/fonts/Geist-ExtraBold.ttf",
          "./assets/fonts/Geist-ExtraLight.ttf",
          "./assets/fonts/Geist-Light.ttf",
          "./assets/fonts/Geist-Medium.ttf",
          "./assets/fonts/Geist-Regular.ttf",
          "./assets/fonts/Geist-SemiBold.ttf",
          "./assets/fonts/GeistMono-ExtraBold.ttf",
          "./assets/fonts/GeistMono-Light.ttf",
          "./assets/fonts/GeistMono-Regular.ttf",
        ],
      },
    ],
    "react-native-audio-api",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#000000",
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
      },
    ],
    "./plugins/with-profileable",
  ],
  scheme: Env.EXPO_PUBLIC_SCHEME,
  slug: "cron",
  userInterfaceStyle: "dark",
  version: Env.EXPO_PUBLIC_VERSION.toString(),
});

export default appConfig;
