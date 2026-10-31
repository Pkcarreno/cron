import { act, cleanup, fireEvent } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import renderer, { act as rendererAct } from "react-test-renderer";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import InputThumbwheel, {
  AnimatedTick,
  FULL_TICK_STYLE,
  HIDDEN_TICK_STYLE,
  TICK_WIDTH,
} from "./input-thumbwheel";

const createMockSharedValue = (initial: number): SharedValue<number> =>
  ({
    get: () => initial,
    set: jest.fn(),
    value: initial,
  }) as unknown as SharedValue<number>;

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

  describe("AnimatedTick ghost pruning and curvature animation", () => {
    it("performs O(1) early exit returning HIDDEN_TICK_STYLE when tick distance to center exceeds 12 units", async () => {
      // scrollX at index 10 (200px) -> centerIndex = 10
      const scrollX = createMockSharedValue(10 * TICK_WIDTH);

      // index 23 -> distance is 13 units (> 12) -> should be hidden
      const screenFarRight = await renderWithProviders(
        <AnimatedTick
          index={23}
          min={0}
          step={1}
          scrollX={scrollX}
          halfWidth={240}
        />
      );

      const viewFarRight = screenFarRight.getByTestId("thumbwheel-tick-23");
      const flatStyleFarRight = StyleSheet.flatten(viewFarRight.props.style);
      expect(flatStyleFarRight.opacity).toBe(HIDDEN_TICK_STYLE.opacity);
      expect(flatStyleFarRight.transform).toEqual(HIDDEN_TICK_STYLE.transform);

      // index -3 (or 0 when centerIndex = 15) -> distance is 15 units (> 12) -> should be hidden
      const scrollXCenter15 = createMockSharedValue(15 * TICK_WIDTH);
      const screenFarLeft = await renderWithProviders(
        <AnimatedTick
          index={0}
          min={0}
          step={1}
          scrollX={scrollXCenter15}
          halfWidth={240}
        />
      );

      const viewFarLeft = screenFarLeft.getByTestId("thumbwheel-tick-0");
      const flatStyleFarLeft = StyleSheet.flatten(viewFarLeft.props.style);
      expect(flatStyleFarLeft.opacity).toBe(HIDDEN_TICK_STYLE.opacity);
      expect(flatStyleFarLeft.transform).toEqual(HIDDEN_TICK_STYLE.transform);
    });

    it("calculates exact cylindrical curvature animation for visible marks within 12 units", async () => {
      // centerIndex = 10
      const scrollX = createMockSharedValue(10 * TICK_WIDTH);
      const halfWidth = 180;

      // Mark at center (distance = 0) -> FULL_TICK_STYLE
      const screenCenter = await renderWithProviders(
        <AnimatedTick
          index={10}
          min={0}
          step={1}
          scrollX={scrollX}
          halfWidth={halfWidth}
        />
      );

      const viewCenter = screenCenter.getByTestId("thumbwheel-tick-10");
      const flatStyleCenter = StyleSheet.flatten(viewCenter.props.style);
      expect(flatStyleCenter.opacity).toBe(FULL_TICK_STYLE.opacity);
      expect(flatStyleCenter.transform).toEqual(FULL_TICK_STYLE.transform);

      // Mark at index 15 (distance = 5 * 20 = 100px)
      // fadeStart = 180 * 0.4 = 72px
      // progress = (100 - 72) / (180 - 72) = 28 / 108
      // expected factor = 1 - 28 / 108 ≈ 0.74074074
      // expected scale = factor^2 ≈ 0.5486968
      const screenIntermediate = await renderWithProviders(
        <AnimatedTick
          index={15}
          min={0}
          step={1}
          scrollX={scrollX}
          halfWidth={halfWidth}
        />
      );

      const viewIntermediate =
        screenIntermediate.getByTestId("thumbwheel-tick-15");
      const flatStyleIntermediate = StyleSheet.flatten(
        viewIntermediate.props.style
      );
      const expectedFactor = 1 - (100 - 72) / (180 - 72);
      const expectedScale = expectedFactor * expectedFactor;

      expect(flatStyleIntermediate.opacity).toBeCloseTo(expectedFactor, 5);
      expect(flatStyleIntermediate.transform).toEqual([
        { scale: expect.any(Number) },
      ]);
      const actualScale = (
        flatStyleIntermediate.transform as [{ scale: number }]
      )[0].scale;
      expect(actualScale).toBeCloseTo(expectedScale, 5);
    });
  });

  describe("Momentum snapping and boundary clamp watchdog timer", () => {
    let activeTrees: renderer.ReactTestRenderer[] = [];

    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
    });

    afterEach(() => {
      rendererAct(() => {
        jest.runOnlyPendingTimers();
        for (const tree of activeTrees) {
          tree.unmount();
        }
        activeTrees = [];
      });
      jest.useRealTimers();
    });

    const renderThumbwheel = (
      props: React.ComponentProps<typeof InputThumbwheel>
    ) => {
      let tree: renderer.ReactTestRenderer | undefined;
      rendererAct(() => {
        tree = renderer.create(<InputThumbwheel {...props} />);
      });
      if (!tree) {
        throw new Error("Failed to render InputThumbwheel");
      }
      activeTrees.push(tree);

      const container = tree.root
        .findAllByProps({
          testID: props.testID ?? "thumbwheel-picker",
        })
        .find((node) => typeof node.props.onLayout === "function");
      if (!container) {
        throw new Error("Failed to find container with onLayout");
      }
      rendererAct(() => {
        container.props.onLayout({
          nativeEvent: { layout: { height: 84, width: 360 } },
        });
      });

      const scrollView = tree.root.findByProps({
        testID: `${props.testID ?? "thumbwheel-picker"}-scroll-view`,
      });

      return { container, scrollView, tree };
    };

    it("provides explicit snapToOffsets to eliminate fractional density cumulative drift", () => {
      const { scrollView } = renderThumbwheel({
        max: 10,
        min: 0,
        step: 1,
        testID: "thumbwheel-test",
        value: 0,
      });

      expect(scrollView.props.snapToOffsets).toEqual([
        0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200,
      ]);
    });

    it("settles directly onto nearest tick on momentum scroll end without secondary programmatic scrolling", () => {
      const onChangeValue = jest.fn();
      const { scrollView } = renderThumbwheel({
        max: 60,
        min: 0,
        onChangeValue,
        step: 1,
        testID: "thumbwheel-test",
        value: 10,
      });

      // Fire momentumScrollEnd with offset 202 (closest index 10 at 200px)
      rendererAct(() => {
        scrollView.props.onMomentumScrollEnd({
          nativeEvent: {
            contentOffset: { x: 202, y: 0 },
          },
        });
      });

      // No change needed since index is still 10
      expect(onChangeValue).not.toHaveBeenCalled();

      // Fire momentumScrollEnd with offset 242 (closest index 12 at 240px)
      rendererAct(() => {
        scrollView.props.onMomentumScrollEnd({
          nativeEvent: {
            contentOffset: { x: 242, y: 0 },
          },
        });
      });

      expect(onChangeValue).toHaveBeenCalledWith(12);
    });

    it("releases interaction lock after 150 ms watchdog debounce when Android clamps to min = 0 boundary without onMomentumScrollEnd", () => {
      const onChangeValue = jest.fn();
      const { scrollView, tree } = renderThumbwheel({
        max: 99,
        min: 0,
        onChangeValue,
        step: 1,
        testID: "thumbwheel-test",
        value: 10,
      });

      // User begins drag
      rendererAct(() => {
        scrollView.props.onScrollBeginDrag();
      });

      // User flings vigorously into min boundary (0)
      rendererAct(() => {
        scrollView.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: { x: 0, y: 0 },
            velocity: { x: -3.5, y: 0 },
          },
        });
      });

      // Android drops onMomentumScrollEnd event completely!
      // At t = 100 ms, watchdog has not expired yet
      rendererAct(() => {
        jest.advanceTimersByTime(100);
      });

      expect(onChangeValue).not.toHaveBeenCalled();

      // Advance past 150 ms watchdog window (total 150 ms)
      rendererAct(() => {
        jest.advanceTimersByTime(50);
      });

      // Watchdog expired, released the interaction lock and settled to 0
      expect(onChangeValue).toHaveBeenCalledWith(0);

      // Verify that after lock is released, external updates (like quick action buttons) work
      rendererAct(() => {
        tree.update(
          <InputThumbwheel
            value={20}
            min={0}
            max={99}
            step={1}
            onChangeValue={onChangeValue}
            testID="thumbwheel-test"
          />
        );
      });

      // Advances programmatic animation smoothly
      rendererAct(() => {
        jest.advanceTimersByTime(350);
      });
    });

    it("releases interaction lock after 150 ms watchdog debounce when Android clamps to max = 99 boundary without onMomentumScrollEnd", () => {
      const onChangeValue = jest.fn();
      const { scrollView } = renderThumbwheel({
        max: 99,
        min: 0,
        onChangeValue,
        step: 1,
        testID: "thumbwheel-test",
        value: 90,
      });

      // User begins drag and flings to max (99 * 20 = 1980px)
      rendererAct(() => {
        scrollView.props.onScrollBeginDrag();
        scrollView.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: { x: 1980, y: 0 },
            velocity: { x: 4.2, y: 0 },
          },
        });
      });

      // At t = 100 ms, watchdog has not fired yet
      rendererAct(() => {
        jest.advanceTimersByTime(100);
      });

      expect(onChangeValue).not.toHaveBeenCalled();

      // Advance past 150 ms
      rendererAct(() => {
        jest.advanceTimersByTime(50);
      });

      expect(onChangeValue).toHaveBeenCalledWith(99);
    });

    it("clears watchdog timer immediately when onMomentumScrollEnd arrives before timeout", () => {
      const onChangeValue = jest.fn();
      const { scrollView } = renderThumbwheel({
        max: 60,
        min: 0,
        onChangeValue,
        step: 1,
        testID: "thumbwheel-test",
        value: 10,
      });

      rendererAct(() => {
        scrollView.props.onScrollBeginDrag();
        scrollView.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: { x: 300, y: 0 },
            velocity: { x: 1.5, y: 0 },
          },
        });
      });

      // Momentum end arrives at 50ms before watchdog
      rendererAct(() => {
        jest.advanceTimersByTime(50);
      });

      rendererAct(() => {
        scrollView.props.onMomentumScrollEnd({
          nativeEvent: {
            contentOffset: { x: 320, y: 0 },
          },
        });
      });

      expect(onChangeValue).toHaveBeenCalledWith(16);

      // Advance past 150 ms: watchdog was cleared, no extra calls
      rendererAct(() => {
        jest.advanceTimersByTime(200);
      });

      expect(onChangeValue).toHaveBeenCalledTimes(1);
    });

    it("settles immediately without scheduling watchdog when drag ends with near-zero velocity", () => {
      const onChangeValue = jest.fn();
      const { scrollView } = renderThumbwheel({
        max: 60,
        min: 0,
        onChangeValue,
        step: 1,
        testID: "thumbwheel-test",
        value: 10,
      });

      rendererAct(() => {
        scrollView.props.onScrollBeginDrag();
        scrollView.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: { x: 260, y: 0 },
            velocity: { x: 0.01, y: 0 },
          },
        });
      });

      // Settles immediately
      expect(onChangeValue).toHaveBeenCalledWith(13);
    });

    it("supports dual-channel dispatch: emits onCommitValue when deceleration halts", () => {
      const onChangeValue = jest.fn();
      const onCommitValue = jest.fn();
      const { scrollView } = renderThumbwheel({
        max: 60,
        min: 0,
        onChangeValue,
        onCommitValue,
        step: 1,
        testID: "thumbwheel-test",
        value: 10,
      });

      rendererAct(() => {
        scrollView.props.onMomentumScrollEnd({
          nativeEvent: {
            contentOffset: { x: 300, y: 0 },
          },
        });
      });

      expect(onChangeValue).toHaveBeenCalledWith(15);
      expect(onCommitValue).toHaveBeenCalledWith(15);
    });

    it("dispatches onCommitValue when Android boundary watchdog timer expires", () => {
      const onCommitValue = jest.fn();
      const { scrollView } = renderThumbwheel({
        max: 99,
        min: 0,
        onCommitValue,
        step: 1,
        testID: "thumbwheel-test",
        value: 10,
      });

      rendererAct(() => {
        scrollView.props.onScrollBeginDrag();
        scrollView.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: { x: 0, y: 0 },
            velocity: { x: -2, y: 0 },
          },
        });
      });

      rendererAct(() => {
        jest.advanceTimersByTime(150);
      });

      expect(onCommitValue).toHaveBeenCalledWith(0);
    });

    it("ignores external value changes while user is actively interacting to prevent backward drift", () => {
      const { scrollView, tree } = renderThumbwheel({
        max: 60,
        min: 0,
        step: 1,
        testID: "thumbwheel-test",
        value: 10,
      });

      rendererAct(() => {
        scrollView.props.onScrollBeginDrag();
      });

      // External prop updates while user is interacting
      rendererAct(() => {
        tree.update(
          <InputThumbwheel
            value={5}
            min={0}
            max={60}
            step={1}
            testID="thumbwheel-test"
          />
        );
      });

      // No programmatic scrolling triggered during active interaction
      rendererAct(() => {
        jest.advanceTimersByTime(350);
      });
    });
  });
});
