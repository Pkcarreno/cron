/* oxlint-disable eslint/class-methods-use-this, eslint/no-empty-function */
import "react-native-gesture-handler/jestSetup";
import type React from "react";

jest.mock("react-native-nitro-modules", () => ({
  NitroModules: {},
  isRuntimeAlive: () => true,
}));

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
