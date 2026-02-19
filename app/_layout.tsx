import { StyleSheet } from 'react-native';
import { colors } from '@/helpers/colors';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
