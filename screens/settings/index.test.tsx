/* oxlint-disable node/global-require, unicorn/prefer-module */
import { act, fireEvent } from "@testing-library/react-native";
import React from "react";

import { Settings } from "@/screens/settings";
import { isHighPrecisionTimerEnabledAtom } from "@/stores/settings";
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
  });

  it("renders the settings menu with Preferences, About & Support, and Developer sections", async () => {
    const screen = await renderWithProviders(<Settings />);

    expect(screen.getByText("Preferences")).toBeTruthy();
    expect(screen.getByText("Preparation")).toBeTruthy();
    expect(screen.getByText("Sounds")).toBeTruthy();
    expect(screen.getByText("Haptics")).toBeTruthy();
    expect(screen.getByText("High-performance timer")).toBeTruthy();
    expect(
      screen.getByText("Increases battery consumption in extended workouts")
    ).toBeTruthy();
    expect(screen.getByText("About & Support")).toBeTruthy();
    expect(screen.getByText("Developer")).toBeTruthy();
  });

  it("toggles high-performance timer and persists to store", async () => {
    const screen = await renderWithProviders(<Settings />);

    expect(screen.store.get(isHighPrecisionTimerEnabledAtom)).toBe(false);

    await act(() => {
      fireEvent.press(screen.getByLabelText("High-performance timer"));
    });
    await screen.rerender(<Settings />);

    expect(screen.store.get(isHighPrecisionTimerEnabledAtom)).toBe(true);

    await act(() => {
      fireEvent.press(screen.getByLabelText("High-performance timer"));
    });
    await screen.rerender(<Settings />);

    expect(screen.store.get(isHighPrecisionTimerEnabledAtom)).toBe(false);
  });
});
