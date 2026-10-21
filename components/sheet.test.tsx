import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import { Sheet, SheetContent } from "./sheet";

describe("SheetContent layout integrity", () => {
  it("renders contentContainer without an unconstrained flex: 1 GestureHandlerRootView inside the sheet", async () => {
    const screen = await renderWithProviders(
      <Sheet open={true}>
        <SheetContent>
          <View testID="inner-content">
            <Text>Content</Text>
          </View>
        </SheetContent>
      </Sheet>
    );

    const innerContent = screen.getByTestId("inner-content");
    const contentContainer = innerContent.parent;
    expect(contentContainer).toBeTruthy();

    // Verify contentContainer does not have flex: 1
    const contentContainerStyle = StyleSheet.flatten(
      contentContainer?.props?.style
    );
    expect(contentContainerStyle?.flex).toBeUndefined();

    // In da876d7, contentContainer was wrapped inside a GestureHandlerRootView:
    // SheetContent -> TrueSheet -> GestureHandlerRootView -> View(contentContainer) -> innerContent
    // Without the bug:
    // SheetContent -> TrueSheet -> View(contentContainer) -> innerContent
    // Let's verify contentContainer's parent does NOT have a flex: 1 style:
    const contentWrapperStyle = StyleSheet.flatten(
      contentContainer?.parent?.props?.style
    );
    expect(contentWrapperStyle?.flex).toBeUndefined();
  });
});
