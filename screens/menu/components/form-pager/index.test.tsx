import { act, fireEvent } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";

import { TimerMode } from "@/helpers/timer/factory";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import { FormPager, useFormPagerContext } from "./index";
import {
  computeDeterministicInsets,
  getMenuBottomInset,
  getMenuTopInset,
  MENU_DOCK_METRICS,
  MENU_HEADER_METRICS,
} from "./metrics";
import type { FormInsets, FormPagerContextValue, FormTabOption } from "./types";

describe("FormPager", () => {
  const contentSpy = jest.fn((insets: FormInsets) => (
    <View
      testID="test-content"
      style={{
        paddingBottom: insets.bottom,
        paddingTop: insets.top,
      }}
    />
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

  it("renders edge-to-edge with deterministic top and bottom insets in content render functions", async () => {
    const screen = await renderWithProviders(
      <FormPager
        options={MOCK_OPTIONS}
        value={TimerMode.FOR_TIME}
        testID="custom-pager"
      />
    );

    expect(screen.getByTestId("custom-pager")).toBeTruthy();
    expect(screen.getByTestId("segmented-tab-bar")).toBeTruthy();

    expect(contentSpy).toHaveBeenCalled();
    const [firstCall] = contentSpy.mock.calls;
    expect(firstCall[0].bottom).toBeGreaterThanOrEqual(
      MENU_DOCK_METRICS.minBottomInset
    );
    expect(firstCall[0].top).toBeGreaterThanOrEqual(156);
  });

  it("propagates custom insets when passed to FormPager", async () => {
    const screen = await renderWithProviders(
      <FormPager
        options={MOCK_OPTIONS}
        value={TimerMode.FOR_TIME}
        insets={{ bottom: 180, top: 220 }}
        testID="custom-pager-insets"
      />
    );

    expect(screen.getByTestId("custom-pager-insets")).toBeTruthy();
    expect(contentSpy).toHaveBeenCalled();
    const [firstCall] = contentSpy.mock.calls;
    expect(firstCall[0].top).toBe(220);
    expect(firstCall[0].bottom).toBe(180);
  });

  it("computes deterministic insets via metric constants without layout thrashing", () => {
    const safeAreaInsets = { bottom: 34, top: 47 };
    const insets = computeDeterministicInsets(safeAreaInsets);

    const expectedTop =
      47 +
      MENU_HEADER_METRICS.headerTitleHeight +
      MENU_HEADER_METRICS.headerMarginBottom +
      MENU_HEADER_METRICS.jobLabelHeight +
      MENU_HEADER_METRICS.jobMarginBottom +
      MENU_HEADER_METRICS.tabBarHeight +
      MENU_HEADER_METRICS.tabBarMarginBottom;
    const expectedBottom = Math.max(
      MENU_DOCK_METRICS.minBottomInset,
      102 + 34 + 24
    );

    expect(insets.top).toBe(expectedTop);
    expect(insets.bottom).toBe(expectedBottom);
    expect(getMenuTopInset(47)).toBe(expectedTop);
    expect(getMenuBottomInset(34)).toBe(expectedBottom);
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

  describe("Compound Components Composition", () => {
    it("renders custom compound layout with Header, TabBar, Viewport, and Dock", async () => {
      const onValueChange = jest.fn();
      const screen = await renderWithProviders(
        <FormPager
          options={MOCK_OPTIONS}
          value={TimerMode.FOR_TIME}
          onValueChange={onValueChange}
        >
          <FormPager.Header testID="custom-header">
            <Text>Floating Header Slot</Text>
          </FormPager.Header>
          <FormPager.TabBar testID="custom-tab-bar" />
          <FormPager.Viewport testID="custom-viewport" />
          <FormPager.Dock testID="custom-dock">
            <Text>Action Dock Slot</Text>
          </FormPager.Dock>
        </FormPager>
      );

      expect(screen.getByTestId("custom-header")).toBeTruthy();
      expect(screen.getByText("Floating Header Slot")).toBeTruthy();
      expect(screen.getByTestId("custom-tab-bar")).toBeTruthy();
      expect(screen.getByTestId("custom-viewport")).toBeTruthy();
      expect(screen.getByTestId("custom-dock")).toBeTruthy();
      expect(screen.getByText("Action Dock Slot")).toBeTruthy();

      // Test tab switching in compound composition
      const intervalTab = screen.getByTestId("menu-tab-INTERVAL");
      await act(() => {
        fireEvent.press(intervalTab);
      });

      const pagerView = screen.getByTestId("custom-viewport");
      await act(() => {
        fireEvent(pagerView, "onPageSelected", {
          nativeEvent: { position: 2 },
        });
      });

      expect(onValueChange).toHaveBeenCalledWith(TimerMode.INTERVAL);
    });

    it("exposes typed context via useFormPagerContext hook and React 19 use API", async () => {
      let contextSnapshot: FormPagerContextValue<TimerMode> | null = null;

      const ContextInspector = () => {
        contextSnapshot = useFormPagerContext<TimerMode>();
        return (
          <Text testID="inspector">
            Active: {contextSnapshot.selectedIndex}
          </Text>
        );
      };

      const screen = await renderWithProviders(
        <FormPager options={MOCK_OPTIONS} value={TimerMode.AMRAP}>
          <ContextInspector />
        </FormPager>
      );

      expect(screen.getByTestId("inspector")).toBeTruthy();
      if (!contextSnapshot) {
        throw new Error("contextSnapshot was not set");
      }
      const snapshot: FormPagerContextValue<TimerMode> = contextSnapshot;
      expect(snapshot.selectedIndex).toBe(1);
      expect(snapshot.options).toBe(MOCK_OPTIONS);
      expect(snapshot.topInset).toBeGreaterThanOrEqual(156);
      expect(snapshot.bottomInset).toBeGreaterThanOrEqual(128);
      expect(snapshot.blurTargetRef).toBeDefined();
    });

    it("throws descriptive error when compound components are used outside of FormPager", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(renderWithProviders(<FormPager.Header />)).rejects.toThrow(
        "FormPager.Header must be rendered within a <FormPager> provider"
      );

      await expect(renderWithProviders(<FormPager.TabBar />)).rejects.toThrow(
        "FormPager.TabBar must be rendered within a <FormPager> provider"
      );

      await expect(renderWithProviders(<FormPager.Viewport />)).rejects.toThrow(
        "FormPager.Viewport must be rendered within a <FormPager> provider"
      );

      await expect(renderWithProviders(<FormPager.Dock />)).rejects.toThrow(
        "FormPager.Dock must be rendered within a <FormPager> provider"
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
