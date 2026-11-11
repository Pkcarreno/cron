import { createStore } from "jotai";
import React from "react";
import * as Reanimated from "react-native-reanimated";
import { act } from "react-test-renderer";

import { TimerMode } from "@/helpers/timer/factory";
import { TimerPhase } from "@/helpers/timer/strategy";
import {
  timerConfigAtom,
  timerPhaseAtom,
  timerSuccessfulPausesCountAtom,
} from "@/screens/timer/atoms";
import {
  AMBIENT_HINT_DURATION_MS,
  TimerAmbientHint,
} from "@/screens/timer/components/timer-ambient-hint";
import { renderWithProviders } from "@/test-utils/render-with-providers";

describe("TimerAmbientHint", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("renders checkpoint-specific text when mode supports checkpoints (e.g. STOP_WATCH)", async () => {
    const store = createStore();
    store.set(timerConfigAtom, { mode: TimerMode.STOP_WATCH });
    store.set(timerPhaseAtom, TimerPhase.WORK);
    store.set(timerSuccessfulPausesCountAtom, 0);

    const screen = await renderWithProviders(<TimerAmbientHint />, { store });

    expect(screen.getByTestId("timer-ambient-hint")).toBeTruthy();
    expect(screen.getByText("HOLD TO PAUSE • DOUBLE-TAP FOR LAP")).toBeTruthy();
  });

  it("renders non-checkpoint text when mode does not support checkpoints (e.g. FOR_TIME)", async () => {
    const store = createStore();
    store.set(timerConfigAtom, {
      mode: TimerMode.FOR_TIME,
      timecapMs: 600_000,
    });
    store.set(timerPhaseAtom, TimerPhase.WORK);
    store.set(timerSuccessfulPausesCountAtom, 0);

    const screen = await renderWithProviders(<TimerAmbientHint />, { store });

    expect(screen.getByTestId("timer-ambient-hint")).toBeTruthy();
    expect(screen.getByText("HOLD ANYWHERE TO PAUSE")).toBeTruthy();
  });

  it("does not render when successful pauses count reaches threshold (>= 3)", async () => {
    const store = createStore();
    store.set(timerConfigAtom, { mode: TimerMode.STOP_WATCH });
    store.set(timerPhaseAtom, TimerPhase.WORK);
    store.set(timerSuccessfulPausesCountAtom, 3);

    const screen = await renderWithProviders(<TimerAmbientHint />, { store });

    expect(screen.queryByTestId("timer-ambient-hint")).toBeNull();
  });

  it("animates opacity in on mount and triggers fade out after duration", async () => {
    const withTimingSpy = jest.spyOn(Reanimated, "withTiming");
    const store = createStore();
    store.set(timerConfigAtom, { mode: TimerMode.STOP_WATCH });
    store.set(timerPhaseAtom, TimerPhase.WORK);
    store.set(timerSuccessfulPausesCountAtom, 0);

    await renderWithProviders(<TimerAmbientHint />, { store });

    expect(withTimingSpy).toHaveBeenCalledWith(0.8, { duration: 300 });

    act(() => {
      jest.advanceTimersByTime(AMBIENT_HINT_DURATION_MS);
    });

    expect(withTimingSpy).toHaveBeenCalledWith(0, { duration: 500 });
  });
});
