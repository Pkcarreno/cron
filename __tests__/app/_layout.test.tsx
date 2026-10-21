import "react-native-gesture-handler/jestSetup";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import renderer, { act } from "react-test-renderer";

import RootLayout from "@/app/_layout";

jest.mock("expo-splash-screen", () => ({
  hideAsync: jest.fn(),
  preventAutoHideAsync: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Stack: () => null,
}));

jest.mock("@rn-primitives/portal", () => ({
  PortalHost: () => null,
}));

describe("RootLayout", () => {
  it("wraps layout in GestureHandlerRootView with flex: 1 style for full viewport bounds", () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(<RootLayout />);
    });

    if (!tree) {
      throw new Error("Failed to render RootLayout");
    }

    const rootView = tree.root.findByType(GestureHandlerRootView);
    expect(rootView).toBeDefined();
    expect(rootView.props.style).toEqual(
      expect.objectContaining({
        flex: 1,
      })
    );
  });
});
