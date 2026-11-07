import { fireEvent } from "@testing-library/react-native";
import React from "react";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import { PermissionAutoPauseBanner } from "./permission-auto-pause-banner";

describe("PermissionAutoPauseBanner", () => {
  it("renders explanation message and handles actions", async () => {
    const onDismiss = jest.fn();
    const onOpenSettings = jest.fn();

    const screen = await renderWithProviders(
      <PermissionAutoPauseBanner
        onDismiss={onDismiss}
        onOpenSettings={onOpenSettings}
      />
    );

    expect(
      screen.getByText(
        "Session paused because notifications are disabled. Enable notifications in Settings to allow background workout tracking."
      )
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("enable-notifications-button"));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId("dismiss-banner-button"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
