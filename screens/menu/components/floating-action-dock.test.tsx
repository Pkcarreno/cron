import { act, cleanup, fireEvent } from "@testing-library/react-native";
import { createStore } from "jotai";
import React from "react";

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
});
