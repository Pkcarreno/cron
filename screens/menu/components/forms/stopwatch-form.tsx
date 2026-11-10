import { ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";

export interface StopWatchFormProps {
  paddingTop?: number;
  paddingBottom?: number;
}

export const StopWatchForm = ({
  paddingTop = 0,
  paddingBottom = 0,
}: StopWatchFormProps) => (
  <ScrollView
    testID="stopwatch-form-scroll"
    showsVerticalScrollIndicator={false}
    style={styles.container}
    contentContainerStyle={[
      styles.contentContainer,
      {
        paddingBottom,
        paddingTop,
      },
    ]}
    scrollIndicatorInsets={{
      bottom: paddingBottom,
      top: paddingTop,
    }}
  >
    <View style={styles.contentWrapper}>
      <View style={styles.header}>
        <Text color="white" size={22} weight="700">
          Stopwatch
        </Text>
      </View>
      <View style={styles.content}>
        <Text colorSubtone="300">This timer counts up with no time limit.</Text>
        <View>
          <Text>Controls:</Text>
          <Text>- Press and hold the screen to pause or finish.</Text>
          <Text>- Double-tap to record a lap.</Text>
        </View>
      </View>
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 8,
  },
  contentContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  contentWrapper: {
    gap: 12,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
  },
});
