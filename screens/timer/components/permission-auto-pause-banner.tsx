import { BellSlashIcon, XIcon } from "phosphor-react-native";
import type { FC } from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/components/button";
import { Text } from "@/components/text";
import { colors } from "@/helpers/colors";

export interface PermissionAutoPauseBannerProps {
  onDismiss?: () => void;
  onOpenSettings: () => void;
}

export const PermissionAutoPauseBanner: FC<PermissionAutoPauseBannerProps> = ({
  onDismiss,
  onOpenSettings,
}) => (
  <View
    style={styles.container}
    testID="permission-auto-pause-banner"
    accessibilityRole="alert"
  >
    <View style={styles.content}>
      <View style={styles.iconContainer}>
        <BellSlashIcon size={20} color={colors.orange} />
      </View>
      <View style={styles.textContainer}>
        <Text colorSubtone="100" weight="600" size={13}>
          Background Tracking Paused
        </Text>
        <Text colorSubtone="400" size={12} style={styles.messageText}>
          Session paused because notifications are disabled. Enable
          notifications in Settings to allow background workout tracking.
        </Text>
      </View>
      {onDismiss ? (
        <Button
          icon={XIcon}
          size="icon"
          variant="ghost"
          onPress={onDismiss}
          testID="dismiss-banner-button"
          accessibilityLabel="Dismiss banner"
        />
      ) : null}
    </View>
    <View style={styles.actions}>
      <Button
        title="Enable Notifications"
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
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 4,
  },
  container: {
    backgroundColor: colors.neutral[900],
    borderColor: colors.neutral[800],
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
  },
  content: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  iconContainer: {
    paddingTop: 2,
  },
  messageText: {
    lineHeight: 16,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
});
