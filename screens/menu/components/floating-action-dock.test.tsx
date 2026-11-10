import { act, cleanup, fireEvent } from "@testing-library/react-native";
import { createStore } from "jotai";
import React from "react";
import { StyleSheet } from "react-native";

import { TimerMode } from "@/helpers/timer/factory";
import { serializeTimerConfig } from "@/helpers/timer/utils/config-serializer";
import { storage } from "@/stores/storage";
import { activeTimerModeAtom, forTimeWorkoutAtom } from "@/stores/workout";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import { FloatingActionDock } from "./floating-action-dock";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("FloatingActionDock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.clearAll();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders dock container, settings button, and enabled Start button when valid", async () => {
    const store = createStore();
    const screen = await renderWithProviders(<FloatingActionDock />, { store });

    const dock = screen.getByTestId("floating-action-dock");
    expect(dock).toBeTruthy();
    expect(dock.props.collapsable).toBe(false);

    const startButton = screen.getByTestId("start-timer-button");
    expect(startButton).toBeTruthy();
    expect(startButton.props.accessibilityState?.disabled).toBe(false);

    await act(() => {
      fireEvent.press(startButton);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      params: serializeTimerConfig({
        mode: TimerMode.FOR_TIME,
        timecapMs: 3 * 60 * 1000,
      }),
      pathname: "/timer",
    });
  });

  it("disables Start button when active workout config is invalid", async () => {
    const store = createStore();
    store.set(activeTimerModeAtom, TimerMode.FOR_TIME);
    store.set(forTimeWorkoutAtom, { timecapMs: 0 });

    const screen = await renderWithProviders(<FloatingActionDock />, { store });

    const startButton = screen.getByRole("button", { name: "Start" });
    expect(startButton.props.accessibilityState?.disabled).toBe(true);

    await act(() => {
      fireEvent.press(startButton);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("renders inside GlassSurface capsule with borderRadius 28 and full border treatment", async () => {
    const store = createStore();
    const screen = await renderWithProviders(<FloatingActionDock />, { store });

    const dock = screen.getByTestId("floating-action-dock");
    expect(dock).toBeTruthy();

    const flattenedStyle = StyleSheet.flatten(dock.props.style);
    expect(flattenedStyle.borderRadius).toBe(28);
    expect(flattenedStyle.borderWidth).toBeDefined();
    expect(flattenedStyle.borderColor).toBeDefined();
  });

  it("applies bottom safe-area offset to the container", async () => {
    const store = createStore();
    const customMetrics = {
      frame: { height: 844, width: 390, x: 0, y: 0 },
      insets: { bottom: 34, left: 0, right: 0, top: 47 },
    };

    const screen = await renderWithProviders(<FloatingActionDock />, {
      initialMetrics: customMetrics,
      store,
    });

    const dock = screen.getByTestId("floating-action-dock");
    const container = dock.parent;
    expect(container).toBeTruthy();

    const containerStyle = StyleSheet.flatten(container?.props.style);
    expect(containerStyle.paddingBottom).toBe(34);
  });
});
