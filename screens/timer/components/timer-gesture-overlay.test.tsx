/* oxlint-disable node/global-require, unicorn/prefer-module */
import { act, cleanup, fireEvent } from "@testing-library/react-native";
import { createStore } from "jotai";
import React from "react";
import { Text } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { TimerMode } from "@/helpers/timer/factory";
import { TimerPhase } from "@/helpers/timer/strategy";
import {
  timerConfigAtom,
  timerPhaseAtom,
  timerSuccessfulPausesCountAtom,
} from "@/screens/timer/atoms";
import {
  TAP_HINT_DEBOUNCE_MS,
  TAP_HINT_VISIBLE_DURATION_MS,
  TimerGestureOverlay,
} from "@/screens/timer/components/timer-gesture-overlay";
import type { TimerActions } from "@/screens/timer/context";
import { TimerContext } from "@/screens/timer/context";
import { renderWithProviders } from "@/test-utils/render-with-providers";

jest.mock("@/components/pressable-area", () => {
  const { Pressable, View } = require("react-native");

  return {
    PressableArea: ({
      children,
      onLongPress,
      onUnassignedTap,
    }: {
      children: React.ReactNode;
      onLongPress?: () => void;
      onUnassignedTap?: () => void;
    }) => (
      <View>
        {children}
        <Pressable
          testID="mock-pressable-area"
          onPress={onUnassignedTap}
          onLongPress={onLongPress}
        />
      </View>
    ),
  };
});

const mockActions: TimerActions = {
  getSummary: jest.fn(),
  handleEndSession: jest.fn(),
  pause: jest.fn(),
  recordCheckpoint: jest.fn(),
  reset: jest.fn(),
  start: jest.fn(),
};

describe("TimerGestureOverlay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("renders children, floating layer, and ambient hint within a zero-reflow layer", async () => {
    const store = createStore();
    store.set(timerConfigAtom, { mode: TimerMode.STOP_WATCH });
    store.set(timerPhaseAtom, TimerPhase.WORK);
    store.set(timerSuccessfulPausesCountAtom, 0);

    const screen = await renderWithProviders(
      <TimerContext.Provider value={mockActions}>
        <TimerGestureOverlay>
          <Text testID="timer-child">Child Element</Text>
        </TimerGestureOverlay>
      </TimerContext.Provider>,
      { store }
    );

    expect(screen.getByTestId("timer-child")).toBeTruthy();

    const floatingLayer = screen.getByTestId("timer-gesture-floating-layer");
    expect(floatingLayer).toBeTruthy();
    expect(floatingLayer.props.pointerEvents).toBe("none");

    expect(screen.getByTestId("timer-ambient-hint")).toBeTruthy();
    expect(screen.getByTestId("timer-tap-recovery-pill")).toBeTruthy();
  });

  it("triggers toast animation on unassigned tap and respects debounce window", async () => {
    const withSpringSpy = jest.spyOn(Reanimated, "withSpring");
    const withTimingSpy = jest.spyOn(Reanimated, "withTiming");
    const onUnassignedTap = jest.fn();

    const store = createStore();
    store.set(timerConfigAtom, {
      mode: TimerMode.FOR_TIME,
      timecapMs: 600_000,
    });
    store.set(timerPhaseAtom, TimerPhase.WORK);
    store.set(timerSuccessfulPausesCountAtom, 0);

    const screen = await renderWithProviders(
      <TimerContext.Provider value={mockActions}>
        <TimerGestureOverlay onUnassignedTap={onUnassignedTap}>
          <Text>Timer Body</Text>
        </TimerGestureOverlay>
      </TimerContext.Provider>,
      { store }
    );

    const trigger = screen.getByTestId("mock-pressable-area");

    // Initial state: withSpring not called for toast
    expect(
      withSpringSpy.mock.calls.filter(
        (call) => call[0] === 1 && call[1]?.duration === 200
      ).length
    ).toBe(0);

    // Fire single tap on mock pressable area
    await act(() => {
      fireEvent.press(trigger);
    });

    expect(onUnassignedTap).toHaveBeenCalledTimes(1);
    expect(withSpringSpy).toHaveBeenCalledWith(1, {
      dampingRatio: 1,
      duration: 200,
    });

    // Immediate second tap within 1500ms debounce does not trigger second spring
    await act(() => {
      fireEvent.press(trigger);
    });
    expect(onUnassignedTap).toHaveBeenCalledTimes(2);
    expect(
      withSpringSpy.mock.calls.filter(
        (call) => call[0] === 1 && call[1]?.duration === 200
      ).length
    ).toBe(1);

    // Advance past visible duration to trigger auto-hide
    await act(() => {
      jest.advanceTimersByTime(TAP_HINT_VISIBLE_DURATION_MS);
    });
    expect(withTimingSpy).toHaveBeenCalledWith(0, { duration: 300 });

    // Advance past debounce window allows subsequent toast trigger
    await act(() => {
      jest.advanceTimersByTime(TAP_HINT_DEBOUNCE_MS);
    });
    await act(() => {
      fireEvent.press(trigger);
    });
    expect(
      withSpringSpy.mock.calls.filter(
        (call) => call[0] === 1 && call[1]?.duration === 200
      ).length
    ).toBe(2);
  });
});
