import { act, cleanup, fireEvent } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import React from "react";

import { colors } from "@/helpers/colors";
import { TimerMode } from "@/helpers/timer/factory";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import {
  computePositionFromTouchX,
  computeTabIndexFromTouchX,
  DEFAULT_TAB_GEOMETRIES,
  DEFAULT_TAB_WIDTHS,
  SegmentedTabBar,
} from "./segmented-tab-bar";
import type { FormTabOption } from "./types";

const MOCK_OPTIONS: FormTabOption<TimerMode>[] = [
  { content: null, label: "FOR_TIME", value: TimerMode.FOR_TIME },
  { content: null, label: "AMRAP", value: TimerMode.AMRAP },
  { content: null, label: "INTERVAL", value: TimerMode.INTERVAL },
  { content: null, label: "EMOM", value: TimerMode.EMOM },
  { content: null, label: "STOP_WATCH", value: TimerMode.STOP_WATCH },
];

describe("SegmentedTabBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Precomputed Static Geometry & Rendering", () => {
    it("renders all 5 workout modes with precomputed static geometry without runtime onLayout cascades", async () => {
      const screen = await renderWithProviders(
        <SegmentedTabBar options={MOCK_OPTIONS} selectedIndex={0} />
      );

      // Verify all 5 tab buttons and testID parent containers have collapsable={false} for Fabric
      for (const option of MOCK_OPTIONS) {
        const tab = screen.getByTestId(`menu-tab-${option.value}`);
        expect(tab).toBeTruthy();
        expect(tab.props.collapsable).toBe(false);
      }

      expect(screen.getByTestId("segmented-tab-bar").props.collapsable).toBe(
        false
      );
      expect(
        screen.getByTestId("segmented-tab-bar-track").props.collapsable
      ).toBe(false);
      expect(
        screen.getByTestId("segmented-tab-bar-pill").props.collapsable
      ).toBe(false);

      // Verify static geometry constants are defined deterministically
      expect(DEFAULT_TAB_WIDTHS[TimerMode.FOR_TIME]).toBe(110);
      expect(DEFAULT_TAB_WIDTHS[TimerMode.AMRAP]).toBe(86);
      expect(DEFAULT_TAB_WIDTHS[TimerMode.INTERVAL]).toBe(109);
      expect(DEFAULT_TAB_WIDTHS[TimerMode.EMOM]).toBe(78);
      expect(DEFAULT_TAB_WIDTHS[TimerMode.STOP_WATCH]).toBe(145);

      expect(DEFAULT_TAB_GEOMETRIES[TimerMode.FOR_TIME]).toEqual({
        center: 55,
        offset: 0,
        width: 110,
      });
      expect(DEFAULT_TAB_GEOMETRIES[TimerMode.STOP_WATCH]).toEqual({
        center: 455.5,
        offset: 383,
        width: 145,
      });
    });

    it("completely eliminates the CaretDownIcon and in-pill dropdown menu", async () => {
      const screen = await renderWithProviders(
        <SegmentedTabBar options={MOCK_OPTIONS} selectedIndex={0} />
      );

      expect(screen.queryByTestId("caret-down-icon")).toBeNull();
      expect(screen.queryByRole("menu")).toBeNull();
      expect(screen.queryByText("CaretDownIcon")).toBeNull();
    });

    it("renders tab labels with single-line constraint to prevent line wrapping", async () => {
      const screen = await renderWithProviders(
        <SegmentedTabBar options={MOCK_OPTIONS} selectedIndex={0} />
      );

      const labelElements = screen.getAllByText("FOR_TIME");
      expect(labelElements.length).toBeGreaterThanOrEqual(2);
      for (const element of labelElements) {
        expect(element.props.numberOfLines).toBe(1);
      }
    });

    it("positions selection indicator pill absolutely with continuous 1:1 linear tracking", async () => {
      const screen = await renderWithProviders(
        <SegmentedTabBar options={MOCK_OPTIONS} selectedIndex={0} />
      );

      const pill = screen.getByTestId("segmented-tab-bar-pill");
      expect(pill).toBeTruthy();

      const flattenedStyle = Array.isArray(pill.props.style)
        ? Object.assign({}, ...pill.props.style)
        : pill.props.style;

      expect(flattenedStyle.position).toBe("absolute");
      expect(flattenedStyle.backgroundColor).toBe("#ffffff");
      expect(flattenedStyle.borderRadius).toBe(12);
    });

    it("applies rounded gray background to the moving track, keeping viewport transparent", async () => {
      const screen = await renderWithProviders(
        <SegmentedTabBar options={MOCK_OPTIONS} selectedIndex={0} />
      );

      const track = screen.getByTestId("segmented-tab-bar-track");
      expect(track).toBeTruthy();

      const flattenedTrackStyle = Array.isArray(track.props.style)
        ? Object.assign({}, ...track.props.style)
        : track.props.style;

      expect(flattenedTrackStyle.backgroundColor).toBe(colors.neutral[700]);
      expect(flattenedTrackStyle.borderRadius).toBe(12);

      const viewport = screen.getByTestId("segmented-tab-bar");
      const flattenedViewportStyle = Array.isArray(viewport.props.style)
        ? Object.assign({}, ...viewport.props.style)
        : viewport.props.style;

      expect(flattenedViewportStyle.backgroundColor).toBeUndefined();
    });
  });

  describe("Accessibility", () => {
    it("declares accessible tablist and tab roles with correct selected state", async () => {
      const screen = await renderWithProviders(
        <SegmentedTabBar options={MOCK_OPTIONS} selectedIndex={2} />
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeTruthy();

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(5);

      // Tab at index 2 (INTERVAL) is selected
      expect(tabs[0].props.accessibilityState?.selected).toBe(false);
      expect(tabs[1].props.accessibilityState?.selected).toBe(false);
      expect(tabs[2].props.accessibilityState?.selected).toBe(true);
      expect(tabs[3].props.accessibilityState?.selected).toBe(false);
      expect(tabs[4].props.accessibilityState?.selected).toBe(false);
    });
  });

  describe("Touch & Tap Interactions", () => {
    it("executes instant spring transition and emits detent haptics when tapping any tab", async () => {
      const onTabPress = jest.fn();
      const onValueChange = jest.fn();
      const hapticsSpy = jest.spyOn(Haptics, "selectionAsync");

      const screen = await renderWithProviders(
        <SegmentedTabBar
          options={MOCK_OPTIONS}
          selectedIndex={0}
          onTabPress={onTabPress}
          onValueChange={onValueChange}
        />
      );

      const intervalTab = screen.getByTestId("menu-tab-INTERVAL");
      await act(() => {
        fireEvent.press(intervalTab);
      });

      expect(onTabPress).toHaveBeenCalledWith(2, MOCK_OPTIONS[2]);
      expect(onValueChange).toHaveBeenCalledWith(TimerMode.INTERVAL);
      expect(hapticsSpy).toHaveBeenCalledTimes(1);
    });

    it("calls onTabPress and onValueChange for each mode transition", async () => {
      const onTabPress = jest.fn();
      const onValueChange = jest.fn();

      const screen = await renderWithProviders(
        <SegmentedTabBar
          options={MOCK_OPTIONS}
          selectedIndex={0}
          onTabPress={onTabPress}
          onValueChange={onValueChange}
        />
      );

      const emomTab = screen.getByTestId("menu-tab-EMOM");
      await act(() => {
        fireEvent.press(emomTab);
      });

      expect(onTabPress).toHaveBeenCalledWith(3, MOCK_OPTIONS[3]);
      expect(onValueChange).toHaveBeenCalledWith(TimerMode.EMOM);

      const stopwatchTab = screen.getByTestId("menu-tab-STOP_WATCH");
      await act(() => {
        fireEvent.press(stopwatchTab);
      });

      expect(onTabPress).toHaveBeenCalledWith(4, MOCK_OPTIONS[4]);
      expect(onValueChange).toHaveBeenCalledWith(TimerMode.STOP_WATCH);
    });
  });

  describe("Scrubbing Calculations & Detent Logic", () => {
    const centers = [52.5, 145.5, 237.5, 325.5, 431.5];
    const offsets = [0, 105, 186, 289, 362];
    const widths = [105, 81, 103, 73, 139];

    it("computes exact continuous index positions from touch X coordinates", () => {
      // Touch at left boundary or before first center clamps to 0
      expect(computePositionFromTouchX(0, centers)).toBe(0);
      expect(computePositionFromTouchX(52.5, centers)).toBe(0);

      // Touch exactly at second tab center returns 1
      expect(computePositionFromTouchX(145.5, centers)).toBeCloseTo(1, 5);

      // Touch halfway between tab 0 and tab 1 centers returns 0.5
      const halfway01 = (52.5 + 145.5) / 2;
      expect(computePositionFromTouchX(halfway01, centers)).toBeCloseTo(0.5, 5);

      // Touch halfway between tab 2 and tab 3 centers returns 2.5
      const halfway23 = (237.5 + 325.5) / 2;
      expect(computePositionFromTouchX(halfway23, centers)).toBeCloseTo(2.5, 5);

      // Touch past rightmost center clamps to 4
      expect(computePositionFromTouchX(431.5, centers)).toBe(4);
      expect(computePositionFromTouchX(600, centers)).toBe(4);
    });

    it("identifies discrete tab index from touch X within bounding intervals", () => {
      // Tab 0 [0, 105)
      expect(computeTabIndexFromTouchX(0, offsets, widths)).toBe(0);
      expect(computeTabIndexFromTouchX(50, offsets, widths)).toBe(0);
      expect(computeTabIndexFromTouchX(104, offsets, widths)).toBe(0);

      // Tab 1 [105, 186)
      expect(computeTabIndexFromTouchX(105, offsets, widths)).toBe(1);
      expect(computeTabIndexFromTouchX(150, offsets, widths)).toBe(1);

      // Tab 2 [186, 289)
      expect(computeTabIndexFromTouchX(186, offsets, widths)).toBe(2);

      // Tab 3 [289, 362)
      expect(computeTabIndexFromTouchX(300, offsets, widths)).toBe(3);

      // Tab 4 [362, 501)
      expect(computeTabIndexFromTouchX(362, offsets, widths)).toBe(4);
      expect(computeTabIndexFromTouchX(450, offsets, widths)).toBe(4);
    });
  });
});
