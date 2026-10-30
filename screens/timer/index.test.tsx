/* oxlint-disable node/global-require, unicorn/prefer-module */
import { act, cleanup, fireEvent } from "@testing-library/react-native";
import { createStore } from "jotai";
import { useAtomValue } from "jotai/react";
import React from "react";

import { Timer } from "@/screens/timer";
import {
  timerContextBannerAtom,
  timerMinutesStrAtom,
  timerModeAbbrAtom,
  timerSecondsStrAtom,
} from "@/screens/timer/atoms";
import { FeedbackService } from "@/services/audio/feedback-service";
import { renderWithProviders } from "@/test-utils/render-with-providers";

const mockBack = jest.fn();
const mockPrepare = jest.fn(() => Promise.resolve());
const mockDispose = jest.fn();
const mockAttach = jest.fn(() => jest.fn());

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: () => null,
  },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({
    durationMs: "60000",
    mode: "AMRAP",
  }),
  useRouter: () => ({
    back: mockBack,
  }),
}));

jest.mock("@/components/pressable-area", () => {
  const ReactMock = require("react");
  const { Pressable, View } = require("react-native");

  return {
    PressableArea: ({
      children,
      onLongPress,
    }: {
      children: React.ReactNode;
      onLongPress?: () => void;
    }) =>
      ReactMock.createElement(
        View,
        null,
        children,
        ReactMock.createElement(Pressable, {
          onPress: onLongPress,
          testID: "pressable-area",
        })
      ),
  };
});

jest.mock("@/services/audio/feedback-service", () => {
  const actual = jest.requireActual("@/services/audio/feedback-service");
  return {
    ...actual,
    FeedbackService: jest.fn().mockImplementation(() => ({
      attach: mockAttach,
      detach: jest.fn(),
      dispose: mockDispose,
      prepare: mockPrepare,
      stop: jest.fn(),
      trigger: jest.fn(),
    })),
  };
});

describe("Timer screen audio lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("initializes FeedbackService and invokes prepare on mount and dispose on unmount", async () => {
    const store = createStore();
    const screen = await renderWithProviders(<Timer />, { store });

    expect(FeedbackService).toHaveBeenCalled();
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockAttach).toHaveBeenCalledTimes(1);

    await act(() => {
      screen.unmount();
    });

    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it("navigates back and disposes feedback service when session ends from summary", async () => {
    const store = createStore();
    const screen = await renderWithProviders(<Timer />, { store });

    // Long press to pause timer and show SummaryFace
    const pressable = screen.getByTestId("pressable-area");
    await act(() => {
      fireEvent.press(pressable);
    });

    // Summary screen should now display "Back to menu" button
    const backButton = screen.getByText("Back to menu");
    expect(backButton).toBeTruthy();

    await act(() => {
      fireEvent.press(backButton);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);

    await act(() => {
      screen.unmount();
    });

    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  describe("Compound Component architecture", () => {
    it("exposes all required compound components on Timer", () => {
      expect(Timer.Root).toBeDefined();
      expect(Timer.Header).toBeDefined();
      expect(Timer.Display).toBeDefined();
      expect(Timer.GestureOverlay).toBeDefined();
      expect(Timer.OledBurnInProtector).toBeDefined();
      expect(Timer.LocalClock).toBeDefined();
      expect(Timer.Summary).toBeDefined();
    });

    it("renders properly when composed via compound components", async () => {
      const store = createStore();
      const screen = await renderWithProviders(
        <Timer.Root>
          <Timer.OledBurnInProtector>
            <Timer.GestureOverlay>
              <Timer.Header />
              <Timer.Display />
            </Timer.GestureOverlay>
          </Timer.OledBurnInProtector>
        </Timer.Root>,
        { store }
      );

      expect(screen.getByTestId("timer-screen")).toBeTruthy();
      expect(screen.getByTestId("timer-display")).toBeTruthy();
      expect(screen.getByTestId("timer-minutes-slot")).toBeTruthy();
      expect(screen.getByTestId("timer-seconds-slot")).toBeTruthy();
      expect(screen.getByTestId("timer-minutes-svg")).toBeTruthy();
      expect(screen.getByTestId("timer-seconds-svg")).toBeTruthy();
      expect(screen.getByTestId("context-label")).toBeTruthy();
    });
  });

  describe("Jotai atom render isolation", () => {
    it("seconds updates do not re-render the minutes SVG, header, or context banner", async () => {
      const store = createStore();
      const screen = await renderWithProviders(<Timer />, { store });

      // Fast-forward through preparation (10 seconds) plus 2 seconds into active workout (58s remaining in AMRAP)
      await act(() => {
        jest.advanceTimersByTime(12_000);
      });

      // Now active workout is at 58 seconds. Minutes is "00", seconds is "58"
      const initialSecondsText =
        screen.getByTestId("timer-seconds-text").props.children.props.children;
      const initialMinutesText =
        screen.getByTestId("timer-minutes-text").props.children.props.children;
      expect(initialMinutesText).toBe("00");
      expect(initialSecondsText).toBe("58");

      // Tick seconds forward by 1 second (1000ms) to 57s remaining
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      const updatedSecondsText =
        screen.getByTestId("timer-seconds-text").props.children.props.children;
      const updatedMinutesText =
        screen.getByTestId("timer-minutes-text").props.children.props.children;

      // Seconds should have advanced to "57"
      expect(updatedSecondsText).toBe("57");
      expect(updatedSecondsText).not.toBe(initialSecondsText);
      // Minutes should remain invariant at "00"
      expect(updatedMinutesText).toBe("00");
      expect(updatedMinutesText).toBe(initialMinutesText);
    });

    it("strictly isolates re-renders so seconds ticks do not re-render minutes, header, or context banner subscribers", async () => {
      const onMinutesRender = jest.fn();
      const onHeaderRender = jest.fn();
      const onBannerRender = jest.fn();
      const onSecondsRender = jest.fn();

      const MinutesSpy = () => {
        useAtomValue(timerMinutesStrAtom);
        onMinutesRender();
        return null;
      };

      const HeaderSpy = () => {
        useAtomValue(timerModeAbbrAtom);
        onHeaderRender();
        return null;
      };

      const BannerSpy = () => {
        useAtomValue(timerContextBannerAtom);
        onBannerRender();
        return null;
      };

      const SecondsSpy = () => {
        useAtomValue(timerSecondsStrAtom);
        onSecondsRender();
        return null;
      };

      const store = createStore();
      await renderWithProviders(
        <Timer.Root>
          <MinutesSpy />
          <HeaderSpy />
          <BannerSpy />
          <SecondsSpy />
        </Timer.Root>,
        { store }
      );

      // Fast forward past preparation phase (10s) + 2s into active workout
      await act(() => {
        jest.advanceTimersByTime(12_000);
      });

      const initialMinutesCalls = onMinutesRender.mock.calls.length;
      const initialHeaderCalls = onHeaderRender.mock.calls.length;
      const initialBannerCalls = onBannerRender.mock.calls.length;
      const initialSecondsCalls = onSecondsRender.mock.calls.length;

      // Advance 1 second tick (1000ms)
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Seconds must have re-rendered
      expect(onSecondsRender.mock.calls.length).toBeGreaterThan(
        initialSecondsCalls
      );

      // Minutes, Header, and Banner MUST NOT have re-rendered
      expect(onMinutesRender.mock.calls.length).toBe(initialMinutesCalls);
      expect(onHeaderRender.mock.calls.length).toBe(initialHeaderCalls);
      expect(onBannerRender.mock.calls.length).toBe(initialBannerCalls);
    });
  });

  describe("Local wall clock minute-boundary isolation", () => {
    it("updates only on the minute boundary without waking workout components", async () => {
      // Set system time to 12:00:45 (45 seconds into the minute)
      jest.setSystemTime(new Date(2026, 0, 1, 12, 0, 45));

      const store = createStore();
      const screen = await renderWithProviders(<Timer.LocalClock />, { store });

      const initialClockText = screen.getByText(/12:00/u);
      expect(initialClockText).toBeTruthy();

      // Advance by 10 seconds to 12:00:55 (still same minute)
      await act(() => {
        jest.advanceTimersByTime(10_000);
      });

      // Wall clock text must still be 12:00
      expect(screen.getByText(/12:00/u)).toBeTruthy();

      // Advance 16 more seconds to 12:01:11 (crosses minute boundary)
      await act(() => {
        jest.advanceTimersByTime(16_000);
      });

      // Wall clock text must now be 12:01
      expect(screen.getByText(/12:01/u)).toBeTruthy();
    });
  });

  describe("Session transitions", () => {
    it("transitions to summary screen on pause and resumes on resume press", async () => {
      const store = createStore();
      const screen = await renderWithProviders(<Timer />, { store });

      // Long press pauses session and transitions to summary screen
      const pressable = screen.getByTestId("pressable-area");
      await act(() => {
        fireEvent.press(pressable);
      });

      expect(screen.getByText("session summary")).toBeTruthy();
      const resumeButton = screen.getByText("Resume session");
      expect(resumeButton).toBeTruthy();

      // Resume session returns to active timer
      await act(() => {
        fireEvent.press(resumeButton);
      });

      expect(screen.getByTestId("timer-screen")).toBeTruthy();
    });
  });
});
