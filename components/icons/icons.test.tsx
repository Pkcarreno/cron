import React from "react";

import Button from "@/components/button";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import { BellSlashIcon } from "./bell-slash-icon";
import { CaretRightIcon } from "./caret-right-icon";
import { SlidersIcon } from "./sliders-icon";

describe("Local SVG icon components", () => {
  it("renders CaretRightIcon with default and custom props", async () => {
    const screen = await renderWithProviders(
      <CaretRightIcon testID="caret-right-icon" />
    );

    const icon = screen.getByTestId("caret-right-icon");
    expect(icon.props.width).toBe(24);
    expect(icon.props.height).toBe(24);

    await screen.rerender(
      <CaretRightIcon testID="caret-right-icon" size={14} color="#ffffff" />
    );

    const updated = screen.getByTestId("caret-right-icon");
    expect(updated.props.width).toBe(14);
    expect(updated.props.height).toBe(14);
  });

  it("renders BellSlashIcon with custom size and tint", async () => {
    const screen = await renderWithProviders(
      <BellSlashIcon testID="bell-slash-icon" size={18} color="#ff8800" />
    );

    const icon = screen.getByTestId("bell-slash-icon");
    expect(icon.props.width).toBe(18);
    expect(icon.props.height).toBe(18);
  });

  it("renders SlidersIcon with custom size and tint", async () => {
    const screen = await renderWithProviders(
      <SlidersIcon testID="sliders-icon" size={32} color="#00ff00" />
    );

    const icon = screen.getByTestId("sliders-icon");
    expect(icon.props.width).toBe(32);
    expect(icon.props.height).toBe(32);
  });

  it("functions seamlessly when passed to Button icon prop", async () => {
    const screen = await renderWithProviders(
      <Button size="icon" icon={SlidersIcon} variant="ghost" />
    );

    expect(screen.getByRole("button")).toBeTruthy();
  });
});
