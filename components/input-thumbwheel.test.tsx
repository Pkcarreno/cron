import { act } from "react-test-renderer";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import InputThumbwheel, {
  getIndexForOffset,
  getOffsetForIndex,
  TICK_WIDTH,
} from "./input-thumbwheel";

describe("InputThumbwheel", () => {
  it("aligns tick center exactly with the container center (dead-center needle alignment)", () => {
    const containerWidth = 320;
    const centerIndex = 5;

    // The scroll offset computed for this index
    const offset = getOffsetForIndex(centerIndex, containerWidth);

    // In ScrollView, content is horizontally padded by leadTrailPad:
    const leadTrailPad = Math.round((containerWidth - TICK_WIDTH) / 2);
    // In content coordinates, the center of tick centerIndex is:
    const tickCenterInContent =
      leadTrailPad + centerIndex * TICK_WIDTH + TICK_WIDTH / 2;

    // When scrolled to offset, its position in viewport/container space is:
    const tickCenterInContainer = tickCenterInContent - offset;

    expect(tickCenterInContainer).toBe(containerWidth / 2);
  });

  it("recovers the exact integer index from offset without rounding drift", () => {
    const containerWidth = 320;
    const totalTicks = 21;

    for (let index = 0; index < totalTicks; index += 1) {
      const offset = getOffsetForIndex(index, containerWidth);
      const recoveredIndex = getIndexForOffset(
        offset,
        containerWidth,
        totalTicks
      );
      expect(recoveredIndex).toBe(index);
    }
  });

  it("renders with accessibilityRole adjustable and accessibilityValue", async () => {
    const screen = await renderWithProviders(
      <InputThumbwheel max={20} min={0} step={1} value={10} />
    );

    const wheel = screen.getByRole("adjustable");
    expect(wheel).toBeTruthy();
    expect(wheel.props.accessibilityValue).toEqual({
      max: 20,
      min: 0,
      now: 10,
    });
  });

  it("does not reset value to 0 on initial mount or call onChangeValue with 0", async () => {
    const onChangeValue = jest.fn();
    const screen = await renderWithProviders(
      <InputThumbwheel
        max={30}
        min={0}
        onChangeValue={onChangeValue}
        step={1}
        value={15}
      />
    );

    const wheel = screen.getByRole("adjustable");

    act(() => {
      wheel.props.onLayout({
        nativeEvent: { layout: { height: 64, width: 300, x: 0, y: 0 } },
      });
    });

    expect(onChangeValue).not.toHaveBeenCalled();
    expect(wheel.props.accessibilityValue.now).toBe(15);
  });

  it("supports accessibility increment and decrement actions", async () => {
    const onChangeValue = jest.fn();
    const screen = await renderWithProviders(
      <InputThumbwheel
        max={20}
        min={0}
        onChangeValue={onChangeValue}
        step={1}
        value={10}
      />
    );

    const wheel = screen.getByRole("adjustable");

    act(() => {
      wheel.props.onAccessibilityAction({
        nativeEvent: { actionName: "increment" },
      });
    });
    expect(onChangeValue).toHaveBeenCalledWith(11);

    act(() => {
      wheel.props.onAccessibilityAction({
        nativeEvent: { actionName: "decrement" },
      });
    });
    expect(onChangeValue).toHaveBeenCalledWith(9);
  });

  it("clamps accessibility actions within min and max boundaries", async () => {
    const onChangeValue = jest.fn();
    const screen = await renderWithProviders(
      <InputThumbwheel
        max={20}
        min={0}
        onChangeValue={onChangeValue}
        step={1}
        value={20}
      />
    );

    const wheel = screen.getByRole("adjustable");

    act(() => {
      wheel.props.onAccessibilityAction({
        nativeEvent: { actionName: "increment" },
      });
    });
    expect(onChangeValue).toHaveBeenCalledWith(20);

    const screenMin = await renderWithProviders(
      <InputThumbwheel
        max={20}
        min={0}
        onChangeValue={onChangeValue}
        step={1}
        value={0}
      />
    );

    const wheelMin = screenMin.getByRole("adjustable");
    act(() => {
      wheelMin.props.onAccessibilityAction({
        nativeEvent: { actionName: "decrement" },
      });
    });
    expect(onChangeValue).toHaveBeenCalledWith(0);
  });

  it("renders major tick labels correctly with absolute positioning to prevent flex width inflation", async () => {
    const screen = await renderWithProviders(
      <InputThumbwheel max={20} min={0} step={1} value={10} />
    );

    const label0 = screen.getByText("0");
    const label5 = screen.getByText("5");
    const label10 = screen.getByText("10");
    const label15 = screen.getByText("15");
    const label20 = screen.getByText("20");

    expect(label0).toBeTruthy();
    expect(label5).toBeTruthy();
    expect(label10).toBeTruthy();
    expect(label15).toBeTruthy();
    expect(label20).toBeTruthy();

    // Verify absolute positioning on labels
    expect(label0.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ position: "absolute" }),
      ])
    );
  });

  it("configures ScrollView for fluid continuous dragging and snaps cleanly to ticks", async () => {
    jest.useFakeTimers();
    const onChangeValue = jest.fn();
    const screen = await renderWithProviders(
      <InputThumbwheel
        max={20}
        min={0}
        onChangeValue={onChangeValue}
        step={1}
        value={10}
      />
    );

    const wheel = screen.getByRole("adjustable");

    act(() => {
      wheel.props.onLayout({
        nativeEvent: { layout: { height: 64, width: 300, x: 0, y: 0 } },
      });
    });

    const [scrollView] = wheel.props.children;
    expect(scrollView.props.horizontal).toBe(true);
    // snapToInterval is omitted so the finger has completely free continuous 1:1 motion
    expect(scrollView.props.snapToInterval).toBeUndefined();
    expect(scrollView.props.decelerationRate).toBe("fast");
    expect(scrollView.props.bounces).toBe(true);
    expect(scrollView.props.overScrollMode).toBe("never");
    expect(scrollView.props.contentOffset).toEqual({ x: 200, y: 0 });

    // Scrolling to offset 220 (tick index 11) dispatches onChangeValue(11)
    act(() => {
      scrollView.props.onScroll({
        nativeEvent: {
          contentOffset: { x: 220, y: 0 },
        },
      });
      jest.runAllTimers();
    });

    expect(onChangeValue).toHaveBeenCalledWith(11);

    // Momentum end at non-integer offset (e.g. 210, between 200 and 220) rounds and settles to 11
    act(() => {
      scrollView.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: { x: 210, y: 0 },
        },
      });
    });

    expect(onChangeValue).toHaveBeenCalledWith(11);

    // Slow release (onScrollEndDrag with velocity = 0) at non-integer offset 190 rounds to index 10 (value 10)
    act(() => {
      scrollView.props.onScrollEndDrag({
        nativeEvent: {
          contentOffset: { x: 190, y: 0 },
          velocity: { x: 0, y: 0 },
        },
      });
    });

    expect(onChangeValue).toHaveBeenCalledWith(10);
    jest.useRealTimers();
  });
});
