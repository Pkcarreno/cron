import type { FC } from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/components/button";
import { BellSlashIcon } from "@/components/icons/bell-slash-icon";
import { Text } from "@/components/text";
import { colors } from "@/helpers/colors";

export interface PermissionAutoPauseBannerProps {
  onDismiss?: () => void;
  onOpenSettings: () => void;
}

export const PermissionAutoPauseBanner: FC<PermissionAutoPauseBannerProps> = ({
  onOpenSettings,
}) => (
  <View
    style={styles.container}
    testID="permission-auto-pause-banner"
    accessibilityRole="alert"
  >
    <View style={styles.header}>
      <BellSlashIcon size={18} color={colors.orange} />
      <Text colorSubtone="100" weight="600" size={13}>
        Background Tracking Paused
      </Text>
    </View>
    <Text colorSubtone="400" size={12} style={styles.messageText}>
      Session paused because notifications are disabled. Enable notifications in
      Settings to allow background workout tracking.
    </Text>
    <View style={styles.actions}>
      <Button
        title="Open Settings"
        size="sm"
        variant="secondary"
        onPress={onOpenSettings}
        testID="enable-notifications-button"
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  actions: {
    width: "100%",
  },
  container: {
    backgroundColor: colors.transparent,
    borderColor: colors.neutral[800],
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  messageText: {
    lineHeight: 16,
  },
});
