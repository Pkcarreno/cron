import React from "react";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import { Logo } from "./logo";

describe("Logo component", () => {
  it("renders with default size (24) and default color (#ffffff)", async () => {
    const screen = await renderWithProviders(<Logo testID="app-logo" />);

    const logo = screen.getByTestId("app-logo");
    expect(logo).toBeTruthy();
    expect(logo.props.width).toBe(24);
    expect(logo.props.height).toBe(24);
  });

  it("renders with custom size and custom color", async () => {
    const screen = await renderWithProviders(
      <Logo testID="app-logo-custom" size={32} color="#ff00ff" />
    );

    const logo = screen.getByTestId("app-logo-custom");
    expect(logo).toBeTruthy();
    expect(logo.props.width).toBe(32);
    expect(logo.props.height).toBe(32);

    await screen.rerender(
      <Logo testID="app-logo-custom" size={48} color="#00ff00" />
    );

    const updated = screen.getByTestId("app-logo-custom");
    expect(updated.props.width).toBe(48);
    expect(updated.props.height).toBe(48);
  });
});
