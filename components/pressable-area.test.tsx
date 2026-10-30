import "react-native-gesture-handler/jestSetup";
import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";
import React from "react";
import { Text, View } from "react-native";
import type {
  LongPressGesture,
  TapGesture,
} from "react-native-gesture-handler";
import {
  GestureDetector,
  GestureHandlerRootView,
  State,
} from "react-native-gesture-handler";
import {
  createGestureController,
  fireGestureHandler,
} from "react-native-gesture-handler/jest-utils";
import * as Reanimated from "react-native-reanimated";
import renderer, { act } from "react-test-renderer";

import {
  triggerAndroidHaptic,
  triggerHaptic,
  triggerType,
} from "@/helpers/haptics";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import { PressableArea } from "./pressable-area";

jest.mock("@/helpers/haptics", () => ({
  triggerAndroidHaptic: jest.fn(),
  triggerHaptic: jest.fn(),
  triggerType: {
    Impact: "Impact",
    Notification: "Notification",
    Selection: "Selection",
  },
}));

interface RenderOptions {
  deadZone?: number;
  doubleTapCooldownMs?: number;
  onDoublePress?: () => void;
  onLongPress?: () => void;
  onPress?: () => void;
}

let activeTrees: renderer.ReactTestRenderer[] = [];

const renderPressableArea = (options: RenderOptions = {}) => {
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <GestureHandlerRootView>
        <PressableArea {...options}>
          <Text>Test Child</Text>
        </PressableArea>
      </GestureHandlerRootView>
    );
  });

  if (!tree) {
    throw new Error("Failed to render PressableArea");
  }

  activeTrees.push(tree);

  const detector = tree.root.findByType(GestureDetector);
  const [doubleTap, longPress, singleTap] = (
    "gestures" in detector.props.gesture
      ? detector.props.gesture.gestures
      : detector.props.gesture.toGestureArray()
  ) as [TapGesture, LongPressGesture, TapGesture];

  return {
    detector,
    doubleTap,
    longPress,
    singleTap,
    tree,
  };
};

describe("PressableArea", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
      for (const tree of activeTrees) {
        tree.unmount();
      }
      activeTrees = [];
    });
    jest.useRealTimers();
  });

  it("renders children successfully", () => {
    const { tree } = renderPressableArea();
    expect(tree.toJSON()).toBeTruthy();
    expect(tree.root.findByType(Text).props.children).toBe("Test Child");
  });

  it("verifies single-tap events trigger the primary press callback without triggering double-press or long-press", () => {
    const onDoublePress = jest.fn();
    const onLongPress = jest.fn();
    const onPress = jest.fn();

    const { singleTap } = renderPressableArea({
      onDoublePress,
      onLongPress,
      onPress,
    });

    act(() => {
      fireGestureHandler(singleTap, [{ state: State.ACTIVE }]);
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDoublePress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
    expect(triggerHaptic).toHaveBeenCalledWith({
      mode: ImpactFeedbackStyle.Medium,
      type: triggerType.Impact,
    });
  });

  it("verifies double-tap events within threshold trigger double-press callback without firing single-tap", () => {
    const onDoublePress = jest.fn();
    const onLongPress = jest.fn();
    const onPress = jest.fn();

    const { doubleTap } = renderPressableArea({
      onDoublePress,
      onLongPress,
      onPress,
    });

    expect(doubleTap.config.numberOfTaps).toBe(2);
    expect(doubleTap.config.runOnJS).toBe(true);

    act(() => {
      fireGestureHandler(doubleTap, [{ state: State.ACTIVE }]);
    });

    expect(onDoublePress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
    expect(triggerHaptic).toHaveBeenCalledWith({
      mode: NotificationFeedbackType.Success,
      type: triggerType.Notification,
    });
  });

  it("verifies long-press events past minimum duration trigger reset callback without firing single-tap", () => {
    const onDoublePress = jest.fn();
    const onLongPress = jest.fn();
    const onPress = jest.fn();

    const { longPress } = renderPressableArea({
      onDoublePress,
      onLongPress,
      onPress,
    });

    const longPressConfig = longPress.config as typeof longPress.config & {
      minDurationMs?: number;
    };
    expect(longPressConfig.minDurationMs ?? longPressConfig.minDuration).toBe(
      600
    );
    expect(longPress.config.runOnJS).toBe(true);

    act(() => {
      fireGestureHandler(longPress, [{ state: State.ACTIVE }]);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    expect(onDoublePress).not.toHaveBeenCalled();
    expect(triggerAndroidHaptic).toHaveBeenCalledWith(
      AndroidHaptics.Long_Press,
      {
        mode: ImpactFeedbackStyle.Heavy,
        type: triggerType.Impact,
      }
    );
  });

  it("responds immediately on touch-down with scale: 0.98 without triggering haptics on touch-down", () => {
    const withSpringSpy = jest.spyOn(Reanimated, "withSpring");
    const onLongPress = jest.fn();

    const { longPress } = renderPressableArea({
      onLongPress,
    });
    const controller = createGestureController(longPress);

    act(() => {
      controller.begin();
    });

    expect(withSpringSpy).toHaveBeenCalledWith(0.98, {
      dampingRatio: 1,
      duration: 150,
    });
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(triggerAndroidHaptic).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("maintains the hold for 600 ms to trigger heavy impact haptics, pauses session, and restores scale to 1", () => {
    const withSpringSpy = jest.spyOn(Reanimated, "withSpring");
    const onLongPress = jest.fn();

    const { longPress } = renderPressableArea({
      onLongPress,
    });
    const controller = createGestureController(longPress);

    act(() => {
      controller.begin();
      controller.activate();
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(triggerAndroidHaptic).toHaveBeenCalledWith(
      AndroidHaptics.Long_Press,
      {
        mode: ImpactFeedbackStyle.Heavy,
        type: triggerType.Impact,
      }
    );
    expect(withSpringSpy).toHaveBeenCalledWith(1, {
      dampingRatio: 1,
      duration: 150,
    });
  });

  it("smoothly returns the container to scale: 1 without pausing when released early before 600 ms", () => {
    const withSpringSpy = jest.spyOn(Reanimated, "withSpring");
    const onLongPress = jest.fn();

    const { longPress } = renderPressableArea({
      onLongPress,
    });
    const controller = createGestureController(longPress);

    act(() => {
      controller.begin();
      controller.fail();
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(triggerAndroidHaptic).not.toHaveBeenCalled();
    expect(withSpringSpy).toHaveBeenLastCalledWith(1, {
      dampingRatio: 1,
      duration: 150,
    });
  });

  it("debounces rapid consecutive double-tap triggers within cooldown period", () => {
    const onDoublePress = jest.fn();

    const { doubleTap } = renderPressableArea({
      doubleTapCooldownMs: 400,
      onDoublePress,
    });

    act(() => {
      fireGestureHandler(doubleTap, [{ state: State.ACTIVE }]);
    });
    expect(onDoublePress).toHaveBeenCalledTimes(1);

    // Rapid follow-up within 400ms cooldown window is dropped
    act(() => {
      fireGestureHandler(doubleTap, [{ state: State.ACTIVE }]);
    });
    expect(onDoublePress).toHaveBeenCalledTimes(1);

    // Advance past cooldown window allows subsequent double-tap
    act(() => {
      jest.advanceTimersByTime(450);
      fireGestureHandler(doubleTap, [{ state: State.ACTIVE }]);
    });
    expect(onDoublePress).toHaveBeenCalledTimes(2);
  });

  it("enforces mutual exclusion rules where single-tap requires double-tap and long-press to fail", () => {
    const onDoublePress = jest.fn();
    const onLongPress = jest.fn();
    const onPress = jest.fn();

    const { detector, doubleTap, longPress, singleTap } = renderPressableArea({
      onDoublePress,
      onLongPress,
      onPress,
    });

    expect(singleTap.config.requireToFail).toContain(doubleTap);
    expect(singleTap.config.requireToFail).toContain(longPress);

    const composedGestures = (detector.props.gesture as { gestures: unknown[] })
      .gestures;
    expect(composedGestures).toEqual([doubleTap, longPress, singleTap]);
  });

  it("disables gestures when corresponding callbacks are omitted", () => {
    const { doubleTap, longPress, singleTap } = renderPressableArea();

    expect(doubleTap.config.enabled).toBe(false);
    expect(longPress.config.enabled).toBe(false);
    expect(singleTap.config.enabled).toBe(false);
  });

  it("enables gestures when corresponding callbacks are provided", () => {
    const { doubleTap, longPress, singleTap } = renderPressableArea({
      onDoublePress: jest.fn(),
      onLongPress: jest.fn(),
      onPress: jest.fn(),
    });

    expect(doubleTap.config.enabled).toBe(true);
    expect(longPress.config.enabled).toBe(true);
    expect(singleTap.config.enabled).toBe(true);
  });

  it("applies default deadZone padding of 0%", () => {
    const { tree } = renderPressableArea();
    const views = tree.root.findAllByType(View);
    const overlayView = views.find(
      (view) => view.props.pointerEvents === "box-none"
    );

    expect(overlayView).toBeDefined();
    expect(overlayView?.props.style).toEqual(
      expect.arrayContaining([{ padding: "0%" }])
    );
  });

  it("applies custom deadZone padding percentage", () => {
    const { tree } = renderPressableArea({ deadZone: 14 });
    const views = tree.root.findAllByType(View);
    const overlayView = views.find(
      (view) => view.props.pointerEvents === "box-none"
    );

    expect(overlayView).toBeDefined();
    expect(overlayView?.props.style).toEqual(
      expect.arrayContaining([{ padding: "14%" }])
    );
  });

  it("renders correctly within the renderWithProviders test harness", async () => {
    const onPress = jest.fn();
    const screen = await renderWithProviders(
      <PressableArea onPress={onPress}>
        <Text testID="harness-target">Harness Target</Text>
      </PressableArea>
    );

    expect(screen.getByTestId("harness-target")).toBeTruthy();
    expect(screen.getByText("Harness Target")).toBeTruthy();
  });
});
