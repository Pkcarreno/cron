import type React from "react";
import { use } from "react";
import { StyleSheet, View } from "react-native";

import { FormPagerContext } from "./context";
import type { FormPagerDockProps } from "./types";

export const FormPagerDock: React.FC<FormPagerDockProps> = ({
  children,
  style,
  pointerEvents = "box-none",
  ...rest
}) => {
  const context = use(FormPagerContext);
  if (!context) {
    throw new Error(
      "FormPager.Dock must be rendered within a <FormPager> provider"
    );
  }

  return (
    <View pointerEvents={pointerEvents} style={[styles.dock, style]} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  dock: {
    // Allows overlay or in-flow placement
  },
});
