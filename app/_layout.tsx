import { StyleSheet } from 'react-native';
import { colors } from '@/helpers/colors';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

/* oxlint-disable jest/require-hook */
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      {/* oxlint-disable react/style-prop-object */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: styles.contentStyle,
          headerShown: false,
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  contentStyle: {
    backgroundColor: colors.black,
  },
});
