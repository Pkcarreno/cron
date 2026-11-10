import type React from "react";
import { use } from "react";
import { StyleSheet, View } from "react-native";

import { FormPagerContext } from "./context";
import type { FormPagerHeaderProps } from "./types";

export const FormPagerHeader: React.FC<FormPagerHeaderProps> = ({
  children,
  style,
  pointerEvents = "box-none",
  ...rest
}) => {
  const context = use(FormPagerContext);
  if (!context) {
    throw new Error(
      "FormPager.Header must be rendered within a <FormPager> provider"
    );
  }

  return (
    <View
      pointerEvents={pointerEvents}
      style={[styles.header, style]}
      {...rest}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    // Allows overlay or in-flow placement
  },
});
