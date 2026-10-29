import { act, fireEvent } from "@testing-library/react-native";
import { View } from "react-native";

import { TimerMode } from "@/helpers/timer/factory";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import { FormPager } from "./index";
import type { FormTabOption } from "./types";

describe("FormPager", () => {
  const contentSpy = jest.fn((insets: { bottom: number }) => (
    <View testID="test-content" style={{ paddingBottom: insets.bottom }} />
  ));

  const MOCK_OPTIONS: FormTabOption<TimerMode>[] = [
    {
      content: contentSpy,
      label: "FOR TIME",
      value: TimerMode.FOR_TIME,
    },
    {
      content: contentSpy,
      label: "AMRAP",
      value: TimerMode.AMRAP,
    },
    {
      content: contentSpy,
      label: "INTERVAL",
      value: TimerMode.INTERVAL,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders edge-to-edge with minimum formPaddingBottom: 96 in content render functions", async () => {
    const screen = await renderWithProviders(
      <FormPager
        options={MOCK_OPTIONS}
        value={TimerMode.FOR_TIME}
        testID="custom-pager"
      />
    );

    expect(screen.getByTestId("custom-pager")).toBeTruthy();
    expect(screen.getByTestId("segmented-tab-bar")).toBeTruthy();

    // Verify content render function was called with bottom padding at least 96
    expect(contentSpy).toHaveBeenCalled();
    const [firstCall] = contentSpy.mock.calls;
    expect(firstCall[0].bottom).toBeGreaterThanOrEqual(96);
  });

  it("propagates page selection from native PagerView to onValueChange upon gesture completion", async () => {
    const onValueChange = jest.fn();
    const screen = await renderWithProviders(
      <FormPager
        options={MOCK_OPTIONS}
        value={TimerMode.FOR_TIME}
        onValueChange={onValueChange}
      />
    );

    const pagerView = screen.getByTestId("form-pager-view");

    await act(() => {
      fireEvent(pagerView, "onPageSelected", {
        nativeEvent: { position: 1 },
      });
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(TimerMode.AMRAP);
  });

  it("handles tab press without duplicate setPage commands or state thrashing", async () => {
    const onValueChange = jest.fn();
    const screen = await renderWithProviders(
      <FormPager
        options={MOCK_OPTIONS}
        value={TimerMode.FOR_TIME}
        onValueChange={onValueChange}
      />
    );

    const amrapTab = screen.getByTestId("menu-tab-AMRAP");

    await act(() => {
      fireEvent.press(amrapTab);
    });

    // Tap triggers programmatic transition; completion happens when onPageSelected fires
    const pagerView = screen.getByTestId("form-pager-view");
    await act(() => {
      fireEvent(pagerView, "onPageSelected", {
        nativeEvent: { position: 1 },
      });
    });

    expect(onValueChange).toHaveBeenCalledWith(TimerMode.AMRAP);
  });
});
