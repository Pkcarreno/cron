import { fireEvent } from "@testing-library/react-native";
import React from "react";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import { PermissionAutoPauseBanner } from "./permission-auto-pause-banner";

describe("PermissionAutoPauseBanner", () => {
  it("renders explanation message and handles actions", async () => {
    const onOpenSettings = jest.fn();

    const screen = await renderWithProviders(
      <PermissionAutoPauseBanner onOpenSettings={onOpenSettings} />
    );

    expect(screen.getByText("Background Tracking Paused")).toBeTruthy();
    expect(
      screen.getByText(
        "Session paused because notifications are disabled. Enable notifications in Settings to allow background workout tracking."
      )
    ).toBeTruthy();

    expect(screen.queryByTestId("dismiss-banner-button")).toBeNull();

    fireEvent.press(screen.getByTestId("enable-notifications-button"));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
