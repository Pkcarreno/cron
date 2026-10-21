import { ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";

export interface StopWatchFormProps {
  paddingBottom: number;
}

export const StopWatchForm = ({ paddingBottom }: StopWatchFormProps) => (
  <ScrollView
    showsVerticalScrollIndicator={false}
    style={styles.container}
    contentContainerStyle={[styles.contentContainer, { paddingBottom }]}
  >
    <View style={styles.contentWrapper}>
      <View style={styles.header}>
        <Text color="white" size={22} weight="700">
          All set!
        </Text>
      </View>
      <View style={styles.content}>
        <Text colorSubtone="300">
          You are in control. The timer will only end when you choose to stop
          it.
        </Text>
        <View>
          <Text>Quick tips:</Text>
          <Text>- Long press anywhere to finish the timer.</Text>
          <Text>- Double tap to log a checkpoint.</Text>
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
