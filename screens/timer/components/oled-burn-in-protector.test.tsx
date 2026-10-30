import React from "react";
import { StyleSheet, Text } from "react-native";
import * as Reanimated from "react-native-reanimated";
import renderer, { act } from "react-test-renderer";

import { colors } from "@/helpers/colors";
import { Timer } from "@/screens/timer";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import {
  DEFAULT_ORBITAL_COORDINATES,
  DEFAULT_ORBITAL_INTERVAL_MS,
  OledBurnInProtector,
} from "./oled-burn-in-protector";

describe("OledBurnInProtector", () => {
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

  it("renders children with #000000 black canvas background and collapsable={false}", async () => {
    const screen = await renderWithProviders(
      <OledBurnInProtector>
        <Text testID="child-text">Active Timer Content</Text>
      </OledBurnInProtector>
    );

    const protector = screen.getByTestId("oled-burn-in-protector");
    expect(protector).toBeTruthy();
    expect(protector.props.collapsable).toBe(false);

    const style = StyleSheet.flatten(protector.props.style);
    expect(style.backgroundColor).toBe(colors.black);
    expect(style.flex).toBe(1);
    expect(screen.getByTestId("child-text")).toBeTruthy();
  });

  it("exposes OledBurnInProtector as compound component on Timer", () => {
    expect(Timer.OledBurnInProtector).toBe(OledBurnInProtector);
  });

  it("translates display contents along the 8-step orbital coordinate path every 90 s using critically damped spring", () => {
    const withSpringSpy = jest.spyOn(Reanimated, "withSpring");
    const onStepChange = jest.fn();

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <OledBurnInProtector onStepChange={onStepChange}>
          <Text>Display</Text>
        </OledBurnInProtector>
      );
    });

    expect(onStepChange).not.toHaveBeenCalled();

    // Advance 90 seconds -> Step 1: (0, 2)
    act(() => {
      jest.advanceTimersByTime(DEFAULT_ORBITAL_INTERVAL_MS);
    });

    expect(onStepChange).toHaveBeenCalledTimes(1);
    expect(onStepChange).toHaveBeenLastCalledWith(
      1,
      DEFAULT_ORBITAL_COORDINATES[1]
    );
    expect(withSpringSpy).toHaveBeenCalledWith(
      DEFAULT_ORBITAL_COORDINATES[1].x,
      {
        dampingRatio: 1,
        duration: 800,
        reduceMotion: Reanimated.ReduceMotion.System,
      }
    );
    expect(withSpringSpy).toHaveBeenCalledWith(
      DEFAULT_ORBITAL_COORDINATES[1].y,
      {
        dampingRatio: 1,
        duration: 800,
        reduceMotion: Reanimated.ReduceMotion.System,
      }
    );

    // Advance through the remaining 6 steps of the 8-step orbital cycle
    for (let i = 2; i < DEFAULT_ORBITAL_COORDINATES.length; i += 1) {
      act(() => {
        jest.advanceTimersByTime(DEFAULT_ORBITAL_INTERVAL_MS);
      });
      expect(onStepChange).toHaveBeenLastCalledWith(
        i,
        DEFAULT_ORBITAL_COORDINATES[i]
      );
    }

    // Advance 90s again -> wraps back to step 0
    act(() => {
      jest.advanceTimersByTime(DEFAULT_ORBITAL_INTERVAL_MS);
    });
    expect(onStepChange).toHaveBeenLastCalledWith(
      0,
      DEFAULT_ORBITAL_COORDINATES[0]
    );

    // Cleanup
    act(() => {
      tree?.unmount();
    });
  });

  it("cleans up timer interval on unmount", () => {
    const onStepChange = jest.fn();
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <OledBurnInProtector onStepChange={onStepChange}>
          <Text>Display</Text>
        </OledBurnInProtector>
      );
    });

    act(() => {
      tree?.unmount();
    });

    act(() => {
      jest.advanceTimersByTime(DEFAULT_ORBITAL_INTERVAL_MS * 2);
    });

    expect(onStepChange).not.toHaveBeenCalled();
  });
});
