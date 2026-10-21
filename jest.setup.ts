/* oxlint-disable eslint/class-methods-use-this, eslint/no-empty-function, node/global-require, unicorn/prefer-module, typescript/no-explicit-any */
import "react-native-gesture-handler/jestSetup";
import type React from "react";

const {
  createJSReanimatedModule,
} = require("react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated");

createJSReanimatedModule().constructor.prototype.setCSSEventHandler = () => {};

jest.mock("react-native-nitro-modules", () => ({
  NitroModules: {},
  isRuntimeAlive: () => true,
}));

jest.mock("react-native-worklets", () =>
  jest.requireActual("react-native-worklets/src/mock")
);

jest.mock("react-native-reanimated", () =>
  jest.requireActual("react-native-reanimated/mock")
);

jest.mock("react-native-audio-api", () =>
  jest.requireActual("react-native-audio-api/mock")
);

jest.mock("@gorhom/bottom-sheet", () =>
  jest.requireActual("@gorhom/bottom-sheet/mock")
);

jest.mock("@rn-primitives/portal", () => ({
  Portal: ({ children }: { children: React.ReactNode }) => children,
  PortalHost: () => null,
}));

jest.mock("@rn-primitives/dropdown-menu", () => {
  const ReactMock = require("react");
  const { Pressable, Text } = require("react-native");

  return {
    Content: ({ children }: { children: React.ReactNode }) => children,
    Group: ({ children }: { children: React.ReactNode }) => children,
    Item: ({ children, onPress, ...props }: any) =>
      ReactMock.createElement(Pressable, { onPress, ...props }, children),
    Label: ({ children, ...props }: any) =>
      ReactMock.createElement(Text, props, children),
    Overlay: ({ children }: { children: React.ReactNode }) => children,
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Root: ({ children }: { children: React.ReactNode }) => children,
    Separator: () => null,
    Sub: ({ children }: { children: React.ReactNode }) => children,
    Trigger: ({ children, onPress, ...props }: any) => {
      if (typeof children === "function") {
        return children({ pressed: false });
      }
      return ReactMock.createElement(
        Pressable,
        { onPress, ...props },
        children
      );
    },
  };
});

jest.mock("@tanstack/devtools-event-client", () => ({
  EventClient: class {
    emit() {}
    on() {
      return () => {
        // no-op
      };
    }
    onAll() {
      return () => {
        // no-op
      };
    }
    onAllPluginEvents() {
      return () => {
        // no-op
      };
    }
    startConnectLoop() {}
    stopConnectLoop() {}
  },
}));
