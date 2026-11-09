import React from "react";
import { StyleSheet } from "react-native";

import { colors } from "@/helpers/colors";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import { Text } from "./text";

describe("Text component", () => {
  it("renders with default props (Geist, weight 400, neutral color)", async () => {
    const screen = await renderWithProviders(
      <Text testID="test-text">Hello World</Text>
    );

    const textElement = screen.getByTestId("test-text");
    expect(textElement).toBeTruthy();
    expect(screen.getByText("Hello World")).toBeTruthy();

    const flatStyle = StyleSheet.flatten(textElement.props.style);
    expect(flatStyle.fontFamily).toBe("Geist");
    expect(flatStyle.fontWeight).toBe("400");
    expect(flatStyle.color).toBe(colors.neutral["400"]);
  });

  it("renders with mono font family when fontType is mono", async () => {
    const screen = await renderWithProviders(
      <Text testID="mono-text" fontType="mono">
        12:34
      </Text>
    );

    const textElement = screen.getByTestId("mono-text");
    const flatStyle = StyleSheet.flatten(textElement.props.style);
    expect(flatStyle.fontFamily).toBe("Geist Mono");
  });

  it("applies tightened font weights correctly", async () => {
    const screen = await renderWithProviders(
      <>
        <Text testID="weight-200" weight="200">
          Lightest
        </Text>
        <Text testID="weight-600" weight="600">
          SemiBold
        </Text>
        <Text testID="weight-800" weight="800">
          ExtraBold
        </Text>
      </>
    );

    const text200 = screen.getByTestId("weight-200");
    const text600 = screen.getByTestId("weight-600");
    const text800 = screen.getByTestId("weight-800");

    expect(StyleSheet.flatten(text200.props.style).fontWeight).toBe("200");
    expect(StyleSheet.flatten(text600.props.style).fontWeight).toBe("600");
    expect(StyleSheet.flatten(text800.props.style).fontWeight).toBe("800");
  });

  it("applies font size and custom solid colors", async () => {
    const screen = await renderWithProviders(
      <Text testID="custom-text" size={32} color="white">
        Header
      </Text>
    );

    const textElement = screen.getByTestId("custom-text");
    const flatStyle = StyleSheet.flatten(textElement.props.style);
    expect(flatStyle.fontSize).toBe(32);
    expect(flatStyle.color).toBe(colors.white);
  });
});
