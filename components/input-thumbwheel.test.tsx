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

  it("renders major tick labels correctly with absolute positioning to prevent flex width inflation", async () => {
    const screen = await renderWithProviders(
      <InputThumbwheel value={10} min={0} max={20} step={1} />
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

  it("configures PanResponder to handle drag gestures and snap smoothly on release", async () => {
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

    // Static touch does not claim responder (prevents jitter and accidental taps)
    expect(wheel.props.onStartShouldSetResponder()).toBe(false);

    // Prevents sheet from terminating pan once granted
    expect(wheel.props.onResponderTerminationRequest()).toBe(false);

    // Layout setup
    wheel.props.onLayout({
      nativeEvent: { layout: { height: 64, width: 300, x: 0, y: 0 } },
    });

    // Touch down event
    const grantEvent = {
      nativeEvent: { touches: [{ pageX: 150, pageY: 30 }] },
      touchHistory: {
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 1,
        numberActiveTouches: 1,
        touchBank: [
          {
            currentPageX: 150,
            currentPageY: 30,
            currentTimeStamp: 1,
            previousPageX: 150,
            previousPageY: 30,
            previousTimeStamp: 1,
            touchActive: true,
          },
        ],
      },
    } as unknown as GestureResponderEvent;

    // Move left by 20px (from 150 to 130) -> advances by +1 tick (from 10 to 11)
    const moveEvent = {
      nativeEvent: { touches: [{ pageX: 130, pageY: 30 }] },
      touchHistory: {
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 2,
        numberActiveTouches: 1,
        touchBank: [
          {
            currentPageX: 130,
            currentPageY: 30,
            currentTimeStamp: 2,
            previousPageX: 150,
            previousPageY: 30,
            previousTimeStamp: 1,
            touchActive: true,
          },
        ],
      },
    } as unknown as GestureResponderEvent;

    // Subsequent move event after responder grant
    const moveEvent2 = {
      nativeEvent: { touches: [{ pageX: 130, pageY: 30 }] },
      touchHistory: {
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 3,
        numberActiveTouches: 1,
        touchBank: [
          {
            currentPageX: 130,
            currentPageY: 30,
            currentTimeStamp: 3,
            previousPageX: 150,
            previousPageY: 30,
            previousTimeStamp: 1,
            touchActive: true,
          },
        ],
      },
    } as unknown as GestureResponderEvent;

    // Simulate touch move cycle in Responder system: Capture updates geometry, then bubble checks
    wheel.props.onMoveShouldSetResponderCapture(moveEvent);
    expect(wheel.props.onMoveShouldSetResponder(moveEvent)).toBe(true);

    wheel.props.onResponderGrant(grantEvent);
    wheel.props.onResponderMove(moveEvent2);
    expect(onChangeValue).toHaveBeenCalledWith(11);

    // Release with velocity snaps without throwing or crashing
    expect(() => {
      wheel.props.onResponderRelease(moveEvent2);
    }).not.toThrow();

    expect(onChangeValue).toHaveBeenCalled();
  });
});
