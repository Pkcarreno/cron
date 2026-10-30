import React from "react";
import { processColor, StyleSheet } from "react-native";

import { colors } from "@/helpers/colors";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import { ContextBannerSvg } from "./svg/context-banner-svg";
import { MinutesSvg } from "./svg/minutes-svg";
import { SecondsSvg } from "./svg/seconds-svg";
import { TimerFace } from "./timer-face";

describe("TimerFace", () => {
  it("renders container with testID='timer-screen' and collapsable={false}", async () => {
    const screen = await renderWithProviders(
      <TimerFace
        currentTime="12:00"
        contextLabel={undefined}
        contextValue={undefined}
        delta={undefined}
        flags={{
          hasCheckpointsBehavior: false,
          isPreparing: false,
          showsMinuteDigits: true,
        }}
        hours=""
        lap={undefined}
        minutes="05"
        modeAbbr="FT"
        seconds="00"
      />
    );

    const container = screen.getByTestId("timer-screen");
    expect(container).toBeTruthy();
    expect(container.props.collapsable).toBe(false);
  });

  it("renders context label container with testID='context-label' and collapsable={false}", async () => {
    const screen = await renderWithProviders(
      <TimerFace
        currentTime="12:00"
        contextLabel="WORK"
        contextValue="1"
        delta={undefined}
        flags={{
          hasCheckpointsBehavior: false,
          isPreparing: false,
          showsMinuteDigits: true,
        }}
        hours=""
        lap={undefined}
        minutes="05"
        modeAbbr="INT"
        seconds="00"
      />
    );

    const contextLabel = screen.getByTestId("context-label");
    expect(contextLabel).toBeTruthy();
    expect(contextLabel.props.collapsable).toBe(false);
  });

  it("divides viewport height equally into twin 50% flex slots for minutes and seconds", async () => {
    const screen = await renderWithProviders(
      <TimerFace
        currentTime="12:00"
        contextLabel="WORK"
        contextValue="1"
        delta={undefined}
        flags={{
          hasCheckpointsBehavior: false,
          isPreparing: false,
          showsMinuteDigits: true,
        }}
        hours=""
        lap={undefined}
        minutes="12"
        modeAbbr="INT"
        seconds="34"
      />
    );

    const minutesSlot = screen.getByTestId("timer-minutes-slot");
    const secondsSlot = screen.getByTestId("timer-seconds-slot");

    const minutesStyle = StyleSheet.flatten(minutesSlot.props.style);
    const secondsStyle = StyleSheet.flatten(secondsSlot.props.style);

    expect(minutesStyle.flex).toBe(1);
    expect(secondsStyle.flex).toBe(1);
  });

  it("renders minutes slot with opacity: 0 during preparation mode (!showsMinuteDigits) preserving layout slot", async () => {
    const screen = await renderWithProviders(
      <TimerFace
        currentTime="12:00"
        contextLabel={undefined}
        contextValue={undefined}
        delta={undefined}
        flags={{
          hasCheckpointsBehavior: false,
          isPreparing: true,
          showsMinuteDigits: false,
        }}
        hours=""
        lap={undefined}
        minutes="00"
        modeAbbr="FT"
        seconds="03"
      />
    );

    const minutesSlot = screen.getByTestId("timer-minutes-slot");
    const secondsSlot = screen.getByTestId("timer-seconds-slot");

    const minutesStyle = StyleSheet.flatten(minutesSlot.props.style);
    const secondsStyle = StyleSheet.flatten(secondsSlot.props.style);

    expect(minutesStyle.opacity).toBe(0);
    expect(minutesStyle.flex).toBe(1);

    expect(secondsStyle.opacity).toBeUndefined();
    expect(secondsStyle.flex).toBe(1);
  });

  it("renders normalized SVG viewBox attributes and Geist Mono tabular typography for minutes and seconds", async () => {
    const screen = await renderWithProviders(
      <TimerFace
        currentTime="12:00"
        contextLabel={undefined}
        contextValue={undefined}
        delta={undefined}
        flags={{
          hasCheckpointsBehavior: false,
          isPreparing: false,
          showsMinuteDigits: true,
        }}
        hours=""
        lap={undefined}
        minutes="42"
        modeAbbr="FT"
        seconds="58"
      />
    );

    const minutesSvg = screen.getByTestId("timer-minutes-svg");
    const secondsSvg = screen.getByTestId("timer-seconds-svg");

    expect(minutesSvg.props.vbWidth).toBe(260);
    expect(minutesSvg.props.vbHeight).toBe(190);
    expect(secondsSvg.props.vbWidth).toBe(260);
    expect(secondsSvg.props.vbHeight).toBe(190);

    expect(screen.getByLabelText("Minutes: 42")).toBeTruthy();
    expect(screen.getByLabelText("Seconds: 58")).toBeTruthy();

    const minutesText = screen.getByTestId("timer-minutes-text");
    const secondsText = screen.getByTestId("timer-seconds-text");

    expect(minutesText.props.font.fontFamily).toBe("Geist Mono");
    expect(minutesText.props.font.fontWeight).toBe("700");
    expect(minutesText.props.children.props.children).toBe("42");

    expect(secondsText.props.font.fontFamily).toBe("Geist Mono");
    expect(secondsText.props.font.fontWeight).toBe("700");
    expect(secondsText.props.children.props.children).toBe("58");
  });

  it("renders context banner SVG with normalized 1000x240 viewBox and tabular typography", async () => {
    const screen = await renderWithProviders(
      <TimerFace
        currentTime="12:00"
        contextLabel="REST"
        contextLabelColor={colors.green}
        contextValue="3"
        contextValueColor={colors.neutral[400]}
        delta={undefined}
        flags={{
          hasCheckpointsBehavior: false,
          isPreparing: false,
          showsMinuteDigits: true,
        }}
        hours=""
        lap={undefined}
        minutes="01"
        modeAbbr="INT"
        seconds="15"
      />
    );

    const bannerSvg = screen.getByTestId("timer-context-banner-svg");
    expect(bannerSvg.props.vbWidth).toBe(1000);
    expect(bannerSvg.props.vbHeight).toBe(240);
    expect(screen.getByLabelText("REST 3")).toBeTruthy();

    const label = screen.getByTestId("context-banner-label");
    expect(label.props.children.props.children).toBe("REST");
    expect(label.props.font.fontFamily).toBe("Geist Mono");
    expect(label.props.font.fontWeight).toBe("900");
    expect(label.props.fill).toEqual({
      payload: processColor(colors.green),
      type: 0,
    });

    const value = screen.getByTestId("context-banner-value");
    expect(value.props.children.props.children).toBe("3");
    expect(value.props.font.fontFamily).toBe("Geist Mono");
    expect(value.props.font.fontWeight).toBe("400");
    expect(value.props.fill).toEqual({
      payload: processColor(colors.neutral[400]),
      type: 0,
    });
  });
});

describe("Vectorial SVG display components", () => {
  it("renders MinutesSvg with custom fill and accessible label", async () => {
    const screen = await renderWithProviders(
      <MinutesSvg fill={colors.red} minutes="08" testID="custom-minutes-svg" />
    );

    const svg = screen.getByTestId("custom-minutes-svg");
    expect(svg.props.vbWidth).toBe(260);
    expect(svg.props.vbHeight).toBe(190);
    expect(screen.getByLabelText("Minutes: 08")).toBeTruthy();

    const text = screen.getByTestId("timer-minutes-text");
    expect(text.props.fill).toEqual({
      payload: processColor(colors.red),
      type: 0,
    });
    expect(text.props.children.props.children).toBe("08");
  });

  it("renders SecondsSvg with custom fill and accessible label", async () => {
    const screen = await renderWithProviders(
      <SecondsSvg fill={colors.blue} seconds="29" testID="custom-seconds-svg" />
    );

    const svg = screen.getByTestId("custom-seconds-svg");
    expect(svg.props.vbWidth).toBe(260);
    expect(svg.props.vbHeight).toBe(190);
    expect(screen.getByLabelText("Seconds: 29")).toBeTruthy();

    const text = screen.getByTestId("timer-seconds-text");
    expect(text.props.fill).toEqual({
      payload: processColor(colors.blue),
      type: 0,
    });
    expect(text.props.children.props.children).toBe("29");
  });

  it("renders ContextBannerSvg empty when label and value are undefined", async () => {
    const screen = await renderWithProviders(
      <ContextBannerSvg testID="empty-banner" />
    );

    const svg = screen.getByTestId("empty-banner");
    expect(svg.props.vbWidth).toBe(1000);
    expect(svg.props.vbHeight).toBe(240);
    expect(screen.queryByTestId("context-banner-label")).toBeNull();
    expect(screen.queryByTestId("context-banner-value")).toBeNull();
  });
});
