import { act, cleanup, fireEvent } from "@testing-library/react-native";
import React from "react";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import InputThumbwheel from "./input-thumbwheel";

describe("InputThumbwheel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with accessibilityRole adjustable and accessibilityValue", async () => {
    const screen = await renderWithProviders(
      <InputThumbwheel value={25} min={0} max={100} step={1} />
    );

    const wheel = screen.getByRole("adjustable");
    expect(wheel).toBeTruthy();
    expect(wheel.props.accessibilityValue).toEqual({
      max: 100,
      min: 0,
      now: 25,
    });
  });

  it("does not reset value to 0 on initial mount or call onChangeValue with 0", async () => {
    const onChangeValue = jest.fn();

    await renderWithProviders(
      <InputThumbwheel
        value={45}
        min={0}
        max={100}
        step={1}
        onChangeValue={onChangeValue}
      />
    );

    expect(onChangeValue).not.toHaveBeenCalled();
  });

  it("supports accessibility increment and decrement actions", async () => {
    const onChangeValue = jest.fn();

    const screen = await renderWithProviders(
      <InputThumbwheel
        value={25}
        min={0}
        max={50}
        step={1}
        onChangeValue={onChangeValue}
      />
    );

    const wheel = screen.getByRole("adjustable");

    await act(() => {
      fireEvent(wheel, "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      });
    });
    expect(onChangeValue).toHaveBeenCalledWith(26);

    await act(() => {
      fireEvent(wheel, "accessibilityAction", {
        nativeEvent: { actionName: "decrement" },
      });
    });
    expect(onChangeValue).toHaveBeenCalledWith(24);
  });

  it("clamps accessibility actions within min and max boundaries", async () => {
    const onChangeValue = jest.fn();

    const screen = await renderWithProviders(
      <InputThumbwheel
        value={0}
        min={0}
        max={10}
        step={1}
        onChangeValue={onChangeValue}
      />
    );

    const wheel = screen.getByRole("adjustable");

    await act(() => {
      fireEvent(wheel, "accessibilityAction", {
        nativeEvent: { actionName: "decrement" },
      });
    });
    expect(onChangeValue).toHaveBeenCalledWith(0);
  });

  it("renders major tick labels correctly", async () => {
    const screen = await renderWithProviders(
      <InputThumbwheel value={10} min={0} max={20} step={1} />
    );

    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("15")).toBeTruthy();
    expect(screen.getByText("20")).toBeTruthy();
  });
});
