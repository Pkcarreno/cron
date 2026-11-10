import React from "react";

import { AmrapForm } from "@/screens/menu/components/forms/amrap-form";
import { EmomForm } from "@/screens/menu/components/forms/emom-form";
import { ForTimeForm } from "@/screens/menu/components/forms/for-time-form";
import { IntervalForm } from "@/screens/menu/components/forms/interval-form";
import { StopWatchForm } from "@/screens/menu/components/forms/stopwatch-form";
import { renderWithProviders } from "@/test-utils/render-with-providers";

describe("Workout Forms Content Insets and Scroll Indicators", () => {
  const TEST_INSETS = {
    paddingBottom: 140,
    paddingTop: 180,
  };

  it("applies paddingTop, paddingBottom, and scrollIndicatorInsets to IntervalForm", async () => {
    const screen = await renderWithProviders(
      <IntervalForm
        paddingTop={TEST_INSETS.paddingTop}
        paddingBottom={TEST_INSETS.paddingBottom}
      />
    );

    const scrollView = screen.getByTestId("interval-form-scroll");
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.objectContaining({
        paddingBottom: TEST_INSETS.paddingBottom,
        paddingTop: TEST_INSETS.paddingTop,
      })
    );
    expect(scrollView.props.scrollIndicatorInsets).toEqual({
      bottom: TEST_INSETS.paddingBottom,
      top: TEST_INSETS.paddingTop,
    });
  });

  it("applies paddingTop, paddingBottom, and scrollIndicatorInsets to EmomForm", async () => {
    const screen = await renderWithProviders(
      <EmomForm
        paddingTop={TEST_INSETS.paddingTop}
        paddingBottom={TEST_INSETS.paddingBottom}
      />
    );

    const scrollView = screen.getByTestId("emom-form-scroll");
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.objectContaining({
        paddingBottom: TEST_INSETS.paddingBottom,
        paddingTop: TEST_INSETS.paddingTop,
      })
    );
    expect(scrollView.props.scrollIndicatorInsets).toEqual({
      bottom: TEST_INSETS.paddingBottom,
      top: TEST_INSETS.paddingTop,
    });
  });

  it("applies paddingTop, paddingBottom, and scrollIndicatorInsets to ForTimeForm", async () => {
    const screen = await renderWithProviders(
      <ForTimeForm
        paddingTop={TEST_INSETS.paddingTop}
        paddingBottom={TEST_INSETS.paddingBottom}
      />
    );

    const scrollView = screen.getByTestId("for-time-form-scroll");
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.objectContaining({
        paddingBottom: TEST_INSETS.paddingBottom,
        paddingTop: TEST_INSETS.paddingTop,
      })
    );
    expect(scrollView.props.scrollIndicatorInsets).toEqual({
      bottom: TEST_INSETS.paddingBottom,
      top: TEST_INSETS.paddingTop,
    });
  });

  it("applies paddingTop, paddingBottom, and scrollIndicatorInsets to AmrapForm", async () => {
    const screen = await renderWithProviders(
      <AmrapForm
        paddingTop={TEST_INSETS.paddingTop}
        paddingBottom={TEST_INSETS.paddingBottom}
      />
    );

    const scrollView = screen.getByTestId("amrap-form-scroll");
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.objectContaining({
        paddingBottom: TEST_INSETS.paddingBottom,
        paddingTop: TEST_INSETS.paddingTop,
      })
    );
    expect(scrollView.props.scrollIndicatorInsets).toEqual({
      bottom: TEST_INSETS.paddingBottom,
      top: TEST_INSETS.paddingTop,
    });
  });

  it("applies paddingTop, paddingBottom, and scrollIndicatorInsets to StopWatchForm", async () => {
    const screen = await renderWithProviders(
      <StopWatchForm
        paddingTop={TEST_INSETS.paddingTop}
        paddingBottom={TEST_INSETS.paddingBottom}
      />
    );

    const scrollView = screen.getByTestId("stopwatch-form-scroll");
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paddingBottom: TEST_INSETS.paddingBottom,
          paddingTop: TEST_INSETS.paddingTop,
        }),
      ])
    );
    expect(scrollView.props.scrollIndicatorInsets).toEqual({
      bottom: TEST_INSETS.paddingBottom,
      top: TEST_INSETS.paddingTop,
    });
  });
});
