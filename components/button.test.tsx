import { act, fireEvent } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import { colors } from "@/helpers/colors";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import Button from "./button";
import { SlidersIcon } from "./icons/sliders-icon";

describe("Button component", () => {
  it("renders with default primary variant and md size", async () => {
    const handlePress = jest.fn();
    const screen = await renderWithProviders(
      <Button testID="test-button" title="Start" onPress={handlePress} />
    );

    const button = screen.getByTestId("test-button");
    expect(button).toBeTruthy();
    expect(screen.getByText("Start")).toBeTruthy();

    const flatStyle = StyleSheet.flatten(button.props.style);
    expect(flatStyle.backgroundColor).toBe(colors.neutral[100]);
    expect(flatStyle.borderRadius).toBe(8);

    await act(() => {
      fireEvent.press(button);
    });
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it("renders with clear variant and transparent background", async () => {
    const screen = await renderWithProviders(
      <Button
        testID="clear-button"
        size="icon"
        icon={SlidersIcon}
        variant="clear"
      />
    );

    const button = screen.getByTestId("clear-button");
    const flatStyle = StyleSheet.flatten(button.props.style);
    expect(flatStyle.backgroundColor).toBe(colors.transparent);
  });

  it("renders with ghost variant and neutral[950] background", async () => {
    const screen = await renderWithProviders(
      <Button
        testID="ghost-button"
        size="icon"
        icon={SlidersIcon}
        variant="ghost"
      />
    );

    const button = screen.getByTestId("ghost-button");
    const flatStyle = StyleSheet.flatten(button.props.style);
    expect(flatStyle.backgroundColor).toBe(colors.neutral[950]);
  });

  it("respects disabled state and prevents press calls", async () => {
    const handlePress = jest.fn();
    const screen = await renderWithProviders(
      <Button
        testID="disabled-button"
        title="Disabled"
        disabled={true}
        onPress={handlePress}
      />
    );

    const button = screen.getByTestId("disabled-button");
    expect(button.props.accessibilityState?.disabled).toBe(true);

    await act(() => {
      fireEvent.press(button);
    });
    expect(handlePress).not.toHaveBeenCalled();
  });
});
