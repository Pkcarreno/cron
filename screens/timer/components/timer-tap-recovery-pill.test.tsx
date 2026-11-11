import { createStore } from "jotai";
import React from "react";
import { makeMutable } from "react-native-reanimated";

import { TimerMode } from "@/helpers/timer/factory";
import { TimerPhase } from "@/helpers/timer/strategy";
import { timerConfigAtom, timerPhaseAtom } from "@/screens/timer/atoms";
import { TimerTapRecoveryPill } from "@/screens/timer/components/timer-tap-recovery-pill";
import { renderWithProviders } from "@/test-utils/render-with-providers";

describe("TimerTapRecoveryPill", () => {
  it("renders pill element with 'Hold to pause' label when checkpoints are not supported", async () => {
    const store = createStore();
    store.set(timerConfigAtom, {
      mode: TimerMode.FOR_TIME,
      timecapMs: 600_000,
    });
    const progress = makeMutable(1);
    const screen = await renderWithProviders(
      <TimerTapRecoveryPill progress={progress} />,
      { store }
    );

    const pillWrapper = screen.getByTestId("timer-tap-recovery-pill");
    expect(pillWrapper).toBeTruthy();
    expect(pillWrapper.props.pointerEvents).toBe("none");
    expect(screen.getByText("Hold to pause")).toBeTruthy();
  });

  it("renders checkpoint-specific text with pipe separator when mode supports checkpoints", async () => {
    const store = createStore();
    store.set(timerConfigAtom, {
      mode: TimerMode.STOP_WATCH,
    });
    store.set(timerPhaseAtom, TimerPhase.WORK);
    const progress = makeMutable(1);
    const screen = await renderWithProviders(
      <TimerTapRecoveryPill progress={progress} />,
      { store }
    );

    expect(screen.getByText("Hold to pause | Double-tap for lap")).toBeTruthy();
  });

  it("allows custom text override", async () => {
    const progress = makeMutable(1);
    const screen = await renderWithProviders(
      <TimerTapRecoveryPill progress={progress} text="Custom notification" />
    );

    expect(screen.getByText("Custom notification")).toBeTruthy();
  });
});
