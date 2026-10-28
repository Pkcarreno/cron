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

  it("renders container and mounts ticks upon layout measurement", async () => {
    const screen = await renderWithProviders(
      <InputThumbwheel
        value={10}
        min={0}
        max={60}
        step={1}
        testID="thumbwheel-test"
      />
    );

    const container = screen.getByTestId("thumbwheel-test");
    expect(container).toBeTruthy();
    expect(container.props.collapsable).toBe(false);

    await act(() => {
      fireEvent(container, "layout", {
        nativeEvent: { layout: { height: 84, width: 360 } },
      });
    });

    // After layout sets width, ticks are rendered
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("15")).toBeTruthy();
  });

  it("handles programmatic value updates smoothly", async () => {
    const screen = await renderWithProviders(
      <InputThumbwheel
        value={10}
        min={0}
        max={60}
        step={1}
        testID="thumbwheel-test"
      />
    );

    const container = screen.getByTestId("thumbwheel-test");
    await act(() => {
      fireEvent(container, "layout", {
        nativeEvent: { layout: { height: 84, width: 360 } },
      });
    });

    expect(screen.getByText("10")).toBeTruthy();

    await act(() => {
      screen.rerender(
        <InputThumbwheel
          value={25}
          min={0}
          max={60}
          step={1}
          testID="thumbwheel-test"
        />
      );
    });

    expect(screen.getByText("25")).toBeTruthy();
  });

  it("defaults testID to thumbwheel-picker and sets collapsable to false", async () => {
    const screen = await renderWithProviders(
      <InputThumbwheel value={10} min={0} max={60} step={1} />
    );

    const container = screen.getByTestId("thumbwheel-picker");
    expect(container).toBeTruthy();
    expect(container.props.collapsable).toBe(false);
  });
});
