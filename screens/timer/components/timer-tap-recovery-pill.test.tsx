import React from "react";
import { makeMutable } from "react-native-reanimated";

import { TimerTapRecoveryPill } from "@/screens/timer/components/timer-tap-recovery-pill";
import { renderWithProviders } from "@/test-utils/render-with-providers";

describe("TimerTapRecoveryPill", () => {
  it("renders pill element with 'Hold to pause' label and pointerEvents none", async () => {
    const progress = makeMutable(1);
    const screen = await renderWithProviders(
      <TimerTapRecoveryPill progress={progress} />
    );

    const pillWrapper = screen.getByTestId("timer-tap-recovery-pill");
    expect(pillWrapper).toBeTruthy();
    expect(pillWrapper.props.pointerEvents).toBe("none");
    expect(screen.getByText("Hold to pause")).toBeTruthy();
  });
});
