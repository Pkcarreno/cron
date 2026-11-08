import React from "react";

import { TimerMode } from "@/helpers/timer/factory";
import type { UISessionSummary } from "@/hooks/use-timer";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import { SummaryFace } from "./summary-face";

describe("SummaryFace", () => {
  const baseSummary: UISessionSummary = {
    activeSessionTimeMs: 600_000,
    checkpoints: [],
    endedAt: new Date(1_700_000_600_000),
    fullyCompleted: true,
    roundsCompleted: 0,
    startedAt: new Date(1_700_000_000_000),
    totalSessionTimeMs: 610_000,
  };

  const handleEndSession = jest.fn();
  const handleResumeSession = jest.fn();

  it("omits the Rounds tile in FOR_TIME mode", async () => {
    const screen = await renderWithProviders(
      <SummaryFace
        handleEndSession={handleEndSession}
        handleResumeSession={handleResumeSession}
        mode={TimerMode.FOR_TIME}
        summary={{
          ...baseSummary,
          roundsCompleted: 0,
        }}
      />
    );

    expect(screen.queryByText("Rounds")).toBeNull();
    expect(screen.getByText("Total Time")).toBeTruthy();
    expect(screen.getByText("Active Time")).toBeTruthy();
  });

  it("omits the Rounds tile in STOP_WATCH mode even when laps exist", async () => {
    const screen = await renderWithProviders(
      <SummaryFace
        handleEndSession={handleEndSession}
        handleResumeSession={handleResumeSession}
        mode={TimerMode.STOP_WATCH}
        summary={{
          ...baseSummary,
          checkpoints: [
            {
              elapsedTimeMs: 30_000,
              lap: 1,
              lapDeltaMs: 0,
              lapDurationMs: 30_000,
              recordedAt: new Date(),
            },
          ],
          roundsCompleted: 0,
        }}
      />
    );

    expect(screen.queryByText("Rounds")).toBeNull();
    // Laps should be shown in the table header instead
    expect(screen.getByText("Lap")).toBeTruthy();
  });

  it("displays the Rounds tile in AMRAP when roundsCompleted > 0", async () => {
    const screen = await renderWithProviders(
      <SummaryFace
        handleEndSession={handleEndSession}
        handleResumeSession={handleResumeSession}
        mode={TimerMode.AMRAP}
        summary={{
          ...baseSummary,
          checkpoints: [
            {
              elapsedTimeMs: 120_000,
              lap: 1,
              lapDeltaMs: 0,
              lapDurationMs: 120_000,
              recordedAt: new Date(),
            },
            {
              elapsedTimeMs: 250_000,
              lap: 2,
              lapDeltaMs: 10_000,
              lapDurationMs: 130_000,
              recordedAt: new Date(),
            },
          ],
          roundsCompleted: 5,
        }}
      />
    );

    expect(screen.getByText("Rounds")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("displays the Rounds tile in INTERVAL mode when roundsCompleted > 0", async () => {
    const screen = await renderWithProviders(
      <SummaryFace
        handleEndSession={handleEndSession}
        handleResumeSession={handleResumeSession}
        mode={TimerMode.INTERVAL}
        summary={{
          ...baseSummary,
          roundsCompleted: 8,
        }}
      />
    );

    expect(screen.getByText("Rounds")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
  });
});
