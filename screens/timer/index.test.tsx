/* oxlint-disable node/global-require, unicorn/prefer-module */
import { act, cleanup, fireEvent } from "@testing-library/react-native";
import { createStore } from "jotai";
import React from "react";

import { Timer } from "@/screens/timer";
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
});
