import { act, fireEvent } from "@testing-library/react-native";
import React from "react";

import * as ForegroundModule from "@/modules/cron-foreground-service/index";
import { Settings } from "@/screens/settings";
import {
  isBackgroundAudioOnlyAllowedAtom,
  isHighPrecisionTimerEnabledAtom,
} from "@/stores/settings";
import { storage } from "@/stores/storage";
import { renderWithProviders } from "@/test-utils/render-with-providers";

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: () => null,
  },
}));

describe("Settings screen", () => {
  beforeEach(() => {
    storage.clearAll();
    jest.restoreAllMocks();
  });

  it("renders the settings menu with Preferences, About & Support, and Developer sections", async () => {
    jest
      .spyOn(ForegroundModule, "hasNotificationPermission")
      .mockResolvedValue(true);

    const screen = await renderWithProviders(<Settings />);

    expect(screen.getByText("Preferences")).toBeTruthy();
    expect(screen.getByText("Preparation")).toBeTruthy();
    expect(screen.getByText("Sounds")).toBeTruthy();
    expect(screen.getByText("Haptics")).toBeTruthy();
    expect(screen.getByText("High-precision timer")).toBeTruthy();
    expect(
      screen.getByText("Uses more battery during long workouts")
    ).toBeTruthy();
    expect(screen.getByText("About and Support")).toBeTruthy();
    expect(screen.getByText("Developer")).toBeTruthy();
  });

  it("toggles high-precision timer and persists to store", async () => {
    jest
      .spyOn(ForegroundModule, "hasNotificationPermission")
      .mockResolvedValue(true);

    const screen = await renderWithProviders(<Settings />);

    expect(screen.store.get(isHighPrecisionTimerEnabledAtom)).toBe(false);

    await act(() => {
      fireEvent.press(screen.getByLabelText("High-precision timer"));
    });
    await screen.rerender(<Settings />);

    expect(screen.store.get(isHighPrecisionTimerEnabledAtom)).toBe(true);

    await act(() => {
      fireEvent.press(screen.getByLabelText("High-precision timer"));
    });
    await screen.rerender(<Settings />);

    expect(screen.store.get(isHighPrecisionTimerEnabledAtom)).toBe(false);
  });

  it("renders audio-only background toggle strictly when notification permissions are blocked", async () => {
    jest
      .spyOn(ForegroundModule, "hasNotificationPermission")
      .mockResolvedValue(false);

    const screen = await renderWithProviders(<Settings />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText("Background audio without notifications")
    ).toBeTruthy();

    expect(screen.store.get(isBackgroundAudioOnlyAllowedAtom)).toBe(false);

    await act(() => {
      fireEvent.press(screen.getByTestId("background-audio-only-switch"));
    });

    expect(screen.store.get(isBackgroundAudioOnlyAllowedAtom)).toBe(true);
  });

  it("omits audio-only background toggle when notification permissions are granted", async () => {
    jest
      .spyOn(ForegroundModule, "hasNotificationPermission")
      .mockResolvedValue(true);

    const screen = await renderWithProviders(<Settings />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.queryByText("Background audio without notifications")
    ).toBeNull();
  });
});
