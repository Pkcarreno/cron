import type { ConfigContext, ExpoConfig } from '@expo/config';
import 'tsx/cjs';
import Env from './env';

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
  if (appEnv === 'production') {
    return {
      android: {
        adaptiveIcon: {
          backgroundColor: '#000000',
        },
      },
      icon: './assets/icon.png',
      ios: {
        icon: {
          dark: './assets/ios-dark.png',
          light: './assets/ios-light.png',
          tinted: './assets/ios-tinted.png',
        },
      },
      web: {
        favicon: './assets/favicon.png',
      },
    };
  }

  if (appEnv === 'preview') {
    return {
      android: {
        adaptiveIcon: {
          backgroundColor: '#E7801F',
        },
      },
      icon: './assets/icon-preview.png',
      ios: {
        icon: {
          dark: './assets/ios-dark-preview.png',
          light: './assets/ios-light-preview.png',
          tinted: './assets/ios-tinted-preview.png',
        },
      },
      web: {
        favicon: './assets/favicon-preview.png',
      },
    };
  }

  return {
    android: {
      adaptiveIcon: {
        backgroundColor: '#008153',
      },
    },
    icon: './assets/icon-dev.png',
    ios: {
      icon: {
        dark: './assets/ios-dark-dev.png',
        light: './assets/ios-light-dev.png',
        tinted: './assets/ios-tinted-dev.png',
      },
    },
    web: {
      favicon: './assets/favicon-dev.png',
    },
  };
};

const appIconsData = getAppIconsData(Env.EXPO_PUBLIC_APP_ENV);

const appConfig = ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  android: {
    adaptiveIcon: {
      backgroundColor: appIconsData.android.adaptiveIcon.backgroundColor,
      foregroundImage: './assets/adaptive-icon.png',
    },
    backgroundColor: '#000000',
    edgeToEdgeEnabled: true,
    package: Env.EXPO_PUBLIC_PACKAGE,
    predictiveBackGestureEnabled: false,
  },
  backgroundColor: '#000000',
  description: 'Hiit Timer App',
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'db7b2cae-63b8-458a-b91c-e4c9a596b7b1',
    },
  },
  icon: appIconsData.icon,
  ios: {
    backgroundColor: '#000000',
    bundleIdentifier: Env.EXPO_PUBLIC_BUNDLE_ID,
    icon: appIconsData.ios.icon,
    supportsTablet: true,
  },
  name: Env.EXPO_PUBLIC_NAME,
  newArchEnabled: true,
  orientation: 'portrait',
  owner: 'pkcarreno',
  plugins: [
    'expo-router',
    [
      'expo-font',
      {
        android: {
          fonts: [
            {
              fontDefinitions: [
                {
                  path: './assets/fonts/Geist-Thin.ttf',
                  weight: 100,
                },
                {
                  path: './assets/fonts/Geist-ThinItalic.ttf',
                  style: 'italic',
                  weight: 100,
                },
                {
                  path: './assets/fonts/Geist-ExtraLight.ttf',
                  weight: 200,
                },
                {
                  path: './assets/fonts/Geist-ExtraLightItalic.ttf',
                  style: 'italic',
                  weight: 200,
                },
                {
                  path: './assets/fonts/Geist-Light.ttf',
                  weight: 300,
                },
                {
                  path: './assets/fonts/Geist-LightItalic.ttf',
                  style: 'italic',
                  weight: 300,
                },
                {
                  path: './assets/fonts/Geist-Regular.ttf',
                  weight: 400,
                },
                {
                  path: './assets/fonts/Geist-Italic.ttf',
                  style: 'italic',
                  weight: 400,
                },
                {
                  path: './assets/fonts/Geist-Medium.ttf',
                  weight: 500,
                },
                {
                  path: './assets/fonts/Geist-MediumItalic.ttf',
                  style: 'italic',
                  weight: 500,
                },
                {
                  path: './assets/fonts/Geist-SemiBold.ttf',
                  weight: 600,
                },
                {
                  path: './assets/fonts/Geist-SemiBoldItalic.ttf',
                  style: 'italic',
                  weight: 600,
                },
                {
                  path: './assets/fonts/Geist-Bold.ttf',
                  weight: 700,
                },
                {
                  path: './assets/fonts/Geist-BoldItalic.ttf',
                  style: 'italic',
                  weight: 700,
                },
                {
                  path: './assets/fonts/Geist-ExtraBold.ttf',
                  weight: 800,
                },
                {
                  path: './assets/fonts/Geist-ExtraBoldItalic.ttf',
                  style: 'italic',
                  weight: 800,
                },
                {
                  path: './assets/fonts/Geist-Black.ttf',
                  weight: 900,
                },
                {
                  path: './assets/fonts/Geist-BlackItalic.ttf',
                  style: 'italic',
                  weight: 900,
                },
              ],
              fontFamily: 'Geist',
            },
            {
              fontDefinitions: [
                {
                  path: './assets/fonts/GeistMono-Thin.ttf',
                  weight: 100,
                },
                {
                  path: './assets/fonts/GeistMono-ThinItalic.ttf',
                  style: 'italic',
                  weight: 100,
                },
                {
                  path: './assets/fonts/GeistMono-ExtraLight.ttf',
                  weight: 200,
                },
                {
                  path: './assets/fonts/GeistMono-ExtraLightItalic.ttf',
                  style: 'italic',
                  weight: 200,
                },
                {
                  path: './assets/fonts/GeistMono-Light.ttf',
                  weight: 300,
                },
                {
                  path: './assets/fonts/GeistMono-LightItalic.ttf',
                  style: 'italic',
                  weight: 300,
                },
                {
                  path: './assets/fonts/GeistMono-Regular.ttf',
                  weight: 400,
                },
                {
                  path: './assets/fonts/GeistMono-Italic.ttf',
                  style: 'italic',
                  weight: 400,
                },
                {
                  path: './assets/fonts/GeistMono-Medium.ttf',
                  weight: 500,
                },
                {
                  path: './assets/fonts/GeistMono-MediumItalic.ttf',
                  style: 'italic',
                  weight: 500,
                },
                {
                  path: './assets/fonts/GeistMono-SemiBold.ttf',
                  weight: 600,
                },
                {
                  path: './assets/fonts/GeistMono-SemiBoldItalic.ttf',
                  style: 'italic',
                  weight: 600,
                },
                {
                  path: './assets/fonts/GeistMono-Bold.ttf',
                  weight: 700,
                },
                {
                  path: './assets/fonts/GeistMono-BoldItalic.ttf',
                  style: 'italic',
                  weight: 700,
                },
                {
                  path: './assets/fonts/GeistMono-ExtraBold.ttf',
                  weight: 800,
                },
                {
                  path: './assets/fonts/GeistMono-ExtraBoldItalic.ttf',
                  style: 'italic',
                  weight: 800,
                },
                {
                  path: './assets/fonts/GeistMono-Black.ttf',
                  weight: 900,
                },
                {
                  path: './assets/fonts/GeistMono-BlackItalic.ttf',
                  style: 'italic',
                  weight: 900,
                },
              ],
              fontFamily: 'Geist Mono',
            },
          ],
        },
        fonts: [
          './assets/fonts/Geist-Black.ttf',
          './assets/fonts/Geist-BlackItalic.ttf',
          './assets/fonts/Geist-Bold.ttf',
          './assets/fonts/Geist-BoldItalic.ttf',
          './assets/fonts/Geist-ExtraBold.ttf',
          './assets/fonts/Geist-ExtraBoldItalic.ttf',
          './assets/fonts/Geist-ExtraLight.ttf',
          './assets/fonts/Geist-ExtraLightItalic.ttf',
          './assets/fonts/Geist-Italic.ttf',
          './assets/fonts/Geist-Light.ttf',
          './assets/fonts/Geist-LightItalic.ttf',
          './assets/fonts/Geist-Medium.ttf',
          './assets/fonts/Geist-MediumItalic.ttf',
          './assets/fonts/Geist-Regular.ttf',
          './assets/fonts/Geist-SemiBold.ttf',
          './assets/fonts/Geist-SemiBoldItalic.ttf',
          './assets/fonts/Geist-Thin.ttf',
          './assets/fonts/Geist-ThinItalic.ttf',
          './assets/fonts/GeistMono-Black.ttf',
          './assets/fonts/GeistMono-BlackItalic.ttf',
          './assets/fonts/GeistMono-Bold.ttf',
          './assets/fonts/GeistMono-BoldItalic.ttf',
          './assets/fonts/GeistMono-ExtraBold.ttf',
          './assets/fonts/GeistMono-ExtraBoldItalic.ttf',
          './assets/fonts/GeistMono-ExtraLight.ttf',
          './assets/fonts/GeistMono-ExtraLightItalic.ttf',
          './assets/fonts/GeistMono-Italic.ttf',
          './assets/fonts/GeistMono-Light.ttf',
          './assets/fonts/GeistMono-LightItalic.ttf',
          './assets/fonts/GeistMono-Medium.ttf',
          './assets/fonts/GeistMono-MediumItalic.ttf',
          './assets/fonts/GeistMono-Regular.ttf',
          './assets/fonts/GeistMono-SemiBold.ttf',
          './assets/fonts/GeistMono-SemiBoldItalic.ttf',
          './assets/fonts/GeistMono-Thin.ttf',
          './assets/fonts/GeistMono-ThinItalic.ttf',
        ],
      },
    ],
    'expo-router',
  ],
  scheme: Env.EXPO_PUBLIC_SCHEME,
  slug: 'cron',
  splash: {
    backgroundColor: '#000000',
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
  },
  userInterfaceStyle: 'dark',
  version: Env.EXPO_PUBLIC_VERSION.toString(),
});

export default appConfig;
