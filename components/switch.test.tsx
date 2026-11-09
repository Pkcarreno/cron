import { fireEvent } from "@testing-library/react-native";
import React from "react";

import { Switch } from "@/components/switch";
import { renderWithProviders } from "@/test-utils/render-with-providers";

describe("Switch component", () => {
  it("renders with default accessibility role and checked state", async () => {
    const onCheckedChange = jest.fn();
    const screen = await renderWithProviders(
      <Switch
        accessibilityLabel="Test switch"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    );

    const switchElement = screen.getByLabelText("Test switch");
    expect(switchElement).toBeTruthy();
    expect(switchElement.props.accessibilityRole).toBe("switch");
    expect(switchElement.props.accessibilityState).toEqual({
      checked: false,
      disabled: false,
    });
  });

  it("fires onCheckedChange when pressed", async () => {
    const onCheckedChange = jest.fn();
    const screen = await renderWithProviders(
      <Switch
        accessibilityLabel="Test switch"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    );

    const switchElement = screen.getByLabelText("Test switch");
    fireEvent.press(switchElement);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("fires onCheckedChange with false when currently checked", async () => {
    const onCheckedChange = jest.fn();
    const screen = await renderWithProviders(
      <Switch
        accessibilityLabel="Test switch"
        checked={true}
        onCheckedChange={onCheckedChange}
      />
    );

    const switchElement = screen.getByLabelText("Test switch");
    fireEvent.press(switchElement);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("does not fire onCheckedChange when disabled", async () => {
    const onCheckedChange = jest.fn();
    const screen = await renderWithProviders(
      <Switch
        accessibilityLabel="Test switch"
        checked={false}
        disabled
        onCheckedChange={onCheckedChange}
      />
    );

    const switchElement = screen.getByLabelText("Test switch");
    expect(switchElement.props.accessibilityState).toEqual({
      checked: false,
      disabled: true,
    });

    fireEvent.press(switchElement);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
