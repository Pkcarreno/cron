import type { GestureResponderEvent } from "react-native";

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

    // The offset computed for this index
    const offset = getOffsetForIndex(centerIndex, containerWidth);

    // In the container coordinate space, the center needle is at containerWidth / 2.
    // The tick center in strip coordinates is: centerIndex * TICK_WIDTH + TICK_WIDTH / 2.
    // When strip is transformed by offset, its position in container space is:
    const tickCenterInContainer =
      offset + (centerIndex * TICK_WIDTH + TICK_WIDTH / 2);

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
      <InputThumbwheel value={10} min={0} max={20} step={1} />
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
        value={15}
        min={0}
        max={30}
        step={1}
        onChangeValue={onChangeValue}
      />
    );

    const wheel = screen.getByRole("adjustable");

    wheel.props.onLayout({
      nativeEvent: { layout: { height: 64, width: 300, x: 0, y: 0 } },
    });

    expect(onChangeValue).not.toHaveBeenCalled();
    expect(wheel.props.accessibilityValue.now).toBe(15);
  });

  it("supports accessibility increment and decrement actions", async () => {
    const onChangeValue = jest.fn();
    const screen = await renderWithProviders(
      <InputThumbwheel
        value={10}
        min={0}
        max={20}
        step={1}
        onChangeValue={onChangeValue}
      />
    );

    const wheel = screen.getByRole("adjustable");

    wheel.props.onAccessibilityAction({
      nativeEvent: { actionName: "increment" },
    });
    expect(onChangeValue).toHaveBeenCalledWith(11);

    wheel.props.onAccessibilityAction({
      nativeEvent: { actionName: "decrement" },
    });
    expect(onChangeValue).toHaveBeenCalledWith(9);
  });

  it("clamps accessibility actions within min and max boundaries", async () => {
    const onChangeValue = jest.fn();
    const screen = await renderWithProviders(
      <InputThumbwheel
        value={20}
        min={0}
        max={20}
        step={1}
        onChangeValue={onChangeValue}
      />
    );

    const wheel = screen.getByRole("adjustable");

    wheel.props.onAccessibilityAction({
      nativeEvent: { actionName: "increment" },
    });
    expect(onChangeValue).toHaveBeenCalledWith(20);

    const screenMin = await renderWithProviders(
      <InputThumbwheel
        value={0}
        min={0}
        max={20}
        step={1}
        onChangeValue={onChangeValue}
      />
    );

    const wheelMin = screenMin.getByRole("adjustable");
    wheelMin.props.onAccessibilityAction({
      nativeEvent: { actionName: "decrement" },
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

  it("configures PanResponder to handle drag gestures inside TrueSheet modals", async () => {
    const onChangeValue = jest.fn();
    const screen = await renderWithProviders(
      <InputThumbwheel
        value={10}
        min={0}
        max={20}
        step={1}
        onChangeValue={onChangeValue}
      />
    );

    const wheel = screen.getByRole("adjustable");

    // Starts on touch
    expect(wheel.props.onStartShouldSetResponder()).toBe(true);

    // Prevents sheet from terminating pan once granted
    expect(wheel.props.onResponderTerminationRequest()).toBe(false);

    // Layout setup
    wheel.props.onLayout({
      nativeEvent: { layout: { height: 64, width: 300, x: 0, y: 0 } },
    });

    // Mock touch event with standard Responder touchBank structure
    const mockEvent = {
      touchHistory: {
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 1,
        numberActiveTouches: 1,
        touchBank: [
          {
            currentPageX: 150,
            currentPageY: 30,
            currentTimeStamp: 1,
            touchActive: true,
          },
        ],
      },
    } as unknown as GestureResponderEvent;

    // Simulate drag interaction
    wheel.props.onResponderGrant(mockEvent);
    wheel.props.onResponderMove(mockEvent, { dx: -20 });
    expect(onChangeValue).toHaveBeenCalled();

    wheel.props.onResponderRelease(mockEvent, { vx: 0 });
  });
});
