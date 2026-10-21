import { act, cleanup, fireEvent } from "@testing-library/react-native";
import { createStore } from "jotai";
import React from "react";

import { TimerMode } from "@/helpers/timer/factory";
import { serializeTimerConfig } from "@/helpers/timer/utils/config-serializer";
import { Menu } from "@/screens/menu";
import { storage } from "@/stores/storage";
import {
  amrapWorkoutAtom,
  emomWorkoutAtom,
  forTimeWorkoutAtom,
  intervalWorkoutAtom,
} from "@/stores/workout";
import { renderWithProviders } from "@/test-utils/render-with-providers";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("Menu integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.clearAll();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with default FOR_TIME mode and navigates when Start is pressed", async () => {
    const store = createStore();
    const screen = await renderWithProviders(<Menu />, { store });

    const startButton = screen.getByRole("button", { name: "Start" });
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

  it("disables Start button and renders inline field error when input is invalid (0 duration)", async () => {
    const store = createStore();
    // Initialize store with 0 duration for FOR_TIME
    store.set(forTimeWorkoutAtom, { timecapMs: 0 });

    const screen = await renderWithProviders(<Menu />, { store });

    // 1. Start button should be disabled
    const startButton = screen.getByRole("button", { name: "Start" });
    expect(startButton.props.accessibilityState?.disabled).toBe(true);

    // 2. Pressing Start should not navigate
    await act(() => {
      fireEvent.press(startButton);
    });
    expect(mockPush).not.toHaveBeenCalled();

    // 3. Inline error message should be displayed
    expect(screen.getByText("Time cap must be at least 1ms")).toBeTruthy();
  });

  it("re-enables Start button and clears error when input is corrected", async () => {
    const store = createStore();
    store.set(forTimeWorkoutAtom, { timecapMs: 0 });

    const screen = await renderWithProviders(<Menu />, { store });

    const startButton = screen.getByRole("button", { name: "Start" });
    expect(startButton.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText("Time cap must be at least 1ms")).toBeTruthy();

    // Correct the minutes from 0 to 5
    const [minutesTrigger] = screen.getAllByText("00");
    await act(() => {
      fireEvent.press(minutesTrigger);
    });

    const plusFiveButtons = screen.getAllByText("+5");
    await act(() => {
      fireEvent.press(plusFiveButtons[0]);
    });

    const saveButtons = screen.getAllByText("Save");
    await act(() => {
      fireEvent.press(saveButtons[0]);
    });

    // Error should be cleared and Start button re-enabled
    expect(screen.queryByText("Time cap must be at least 1ms")).toBeNull();
    expect(startButton.props.accessibilityState?.disabled).toBe(false);

    await act(() => {
      fireEvent.press(startButton);
    });

    expect(mockPush).toHaveBeenCalledWith({
      params: serializeTimerConfig({
        mode: TimerMode.FOR_TIME,
        timecapMs: 5 * 60 * 1000,
      }),
      pathname: "/timer",
    });
  });

  it("supports quick action increments and saving via controlled NumberPickerSheet", async () => {
    const store = createStore();
    const screen = await renderWithProviders(<Menu />, { store });

    // Default FOR_TIME has 03 minutes and 00 seconds
    // Find the minutes trigger ("03")
    const [minutesTrigger] = screen.getAllByText("03");

    // 1. Open the number picker bottom sheet
    await act(() => {
      fireEvent.press(minutesTrigger);
    });

    // 2. Tap +5 quick action (first visible instance)
    const plusFiveButtons = screen.getAllByText("+5");
    expect(plusFiveButtons.length).toBeGreaterThan(0);
    await act(() => {
      fireEvent.press(plusFiveButtons[0]);
    });

    // 3. Save the new value
    const saveButtons = screen.getAllByText("Save");
    await act(() => {
      fireEvent.press(saveButtons[0]);
    });

    // 4. Verify value updated in atom and storage
    expect(store.get(forTimeWorkoutAtom).timecapMs).toBe(8 * 60 * 1000);

    // 5. Start button navigates with updated payload
    const startButton = screen.getByRole("button", { name: "Start" });
    await act(() => {
      fireEvent.press(startButton);
    });

    expect(mockPush).toHaveBeenCalledWith({
      params: serializeTimerConfig({
        mode: TimerMode.FOR_TIME,
        timecapMs: 8 * 60 * 1000,
      }),
      pathname: "/timer",
    });
  });

  it("restores customized workout settings from persistent store", async () => {
    const store = createStore();
    // Pre-populate customized settings for all modes
    store.set(forTimeWorkoutAtom, { timecapMs: 5 * 60 * 1000 });
    store.set(amrapWorkoutAtom, { durationMs: 15 * 60 * 1000 });
    store.set(emomWorkoutAtom, { roundDurationMs: 45 * 1000, totalRounds: 8 });
    store.set(intervalWorkoutAtom, {
      restMs: 10 * 1000,
      totalRounds: 6,
      workMs: 20 * 1000,
    });

    const screen = await renderWithProviders(<Menu />, { store });

    // FOR_TIME starts with customized 5 minutes
    const startButton = screen.getByRole("button", { name: "Start" });
    await act(() => {
      fireEvent.press(startButton);
    });

    expect(mockPush).toHaveBeenCalledWith({
      params: serializeTimerConfig({
        mode: TimerMode.FOR_TIME,
        timecapMs: 5 * 60 * 1000,
      }),
      pathname: "/timer",
    });
  });

  it("updates EMOM presets and persists round duration and total rounds", async () => {
    const store = createStore();
    const screen = await renderWithProviders(<Menu />, { store });

    // Switch to EMOM page (index 3 in TIMER_MODES: FOR_TIME=0, AMRAP=1, INTERVAL=2, EMOM=3)
    const pagerView = screen.getByTestId("form-pager-view");
    await act(() => {
      fireEvent(pagerView, "onPageSelected", {
        nativeEvent: { position: 3 },
      });
    });

    // Click 45 sec preset
    const preset45Sec = screen.getByText("45 sec");
    await act(() => {
      fireEvent.press(preset45Sec);
    });

    expect(store.get(emomWorkoutAtom).roundDurationMs).toBe(45_000);

    const startButton = screen.getByRole("button", { name: "Start" });
    await act(() => {
      fireEvent.press(startButton);
    });

    expect(mockPush).toHaveBeenCalledWith({
      params: serializeTimerConfig({
        mode: TimerMode.EMOM,
        roundDurationMs: 45_000,
        totalRounds: 3,
      }),
      pathname: "/timer",
    });
  });

  it("updates INTERVAL TABATA preset and persists work, rest, and total rounds", async () => {
    const store = createStore();
    const screen = await renderWithProviders(<Menu />, { store });

    // Switch to INTERVAL page (index 2 in TIMER_MODES)
    const pagerView = screen.getByTestId("form-pager-view");
    await act(() => {
      fireEvent(pagerView, "onPageSelected", {
        nativeEvent: { position: 2 },
      });
    });

    const tabataPreset = screen.getByText("TABATA");
    await act(() => {
      fireEvent.press(tabataPreset);
    });

    expect(store.get(intervalWorkoutAtom)).toEqual({
      restMs: 10_000,
      totalRounds: 8,
      workMs: 20_000,
    });

    const startButton = screen.getByRole("button", { name: "Start" });
    await act(() => {
      fireEvent.press(startButton);
    });

    expect(mockPush).toHaveBeenCalledWith({
      params: serializeTimerConfig({
        mode: TimerMode.INTERVAL,
        restMs: 10_000,
        totalRounds: 8,
        workMs: 20_000,
      }),
      pathname: "/timer",
    });
  });
});
