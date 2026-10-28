import React from "react";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import { TimerFace } from "./timer-face";

describe("TimerFace", () => {
  it("renders container with testID='timer-screen' and collapsable={false}", async () => {
    const screen = await renderWithProviders(
      <TimerFace
        hours=""
        minutes="05"
        seconds="00"
        modeAbbr="FT"
        currentTime="12:00"
        contextLabel={undefined}
        contextValue={undefined}
        lap={undefined}
        delta={undefined}
        flags={{
          hasCheckpointsBehavior: false,
          isPreparing: false,
          showsMinuteDigits: true,
        }}
      />
    );

    const container = screen.getByTestId("timer-screen");
    expect(container).toBeTruthy();
    expect(container.props.collapsable).toBe(false);
  });

  it("renders context label container with testID='context-label' and collapsable={false}", async () => {
    const screen = await renderWithProviders(
      <TimerFace
        hours=""
        minutes="05"
        seconds="00"
        modeAbbr="INT"
        currentTime="12:00"
        contextLabel="WORK"
        contextValue="1"
        lap={undefined}
        delta={undefined}
        flags={{
          hasCheckpointsBehavior: false,
          isPreparing: false,
          showsMinuteDigits: true,
        }}
      />
    );

    const contextLabel = screen.getByTestId("context-label");
    expect(contextLabel).toBeTruthy();
    expect(contextLabel.props.collapsable).toBe(false);
  });
});
