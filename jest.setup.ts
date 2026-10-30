/* oxlint-disable eslint/class-methods-use-this, eslint/no-empty-function, node/global-require, unicorn/prefer-module, typescript/no-explicit-any, eslint/max-classes-per-file */
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

jest.mock("react-native-reanimated", () => {
  const ReanimatedMock = jest.requireActual("react-native-reanimated/mock");
  return {
    ...ReanimatedMock,
    useEvent: (handler: (event: any) => void) => (event: any) => handler(event),
  };
});

jest.mock("react-native-audio-api", () => {
  const actual = jest.requireActual("react-native-audio-api/mock");
  return {
    ...actual,
    AudioManager: {
      ...actual.AudioManager,
      observeAudioInterruptions: jest.fn(),
      setAudioSessionActivity: jest.fn(() => Promise.resolve()),
      setAudioSessionOptions: jest.fn(),
    },
  };
});

jest.mock("expo-battery", () => ({
  addBatteryLevelListener: () => ({ remove: jest.fn() }),
  useBatteryLevel: () => 1,
}));

jest.mock("@lodev09/react-native-true-sheet", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");

  class TrueSheet extends ReactMock.Component<any, any> {
    present: any = jest.fn((...args: any[]): Promise<any> =>
      TrueSheet.prototype.present.apply(this, args)
    );
    dismiss: any = jest.fn((...args: any[]): Promise<any> =>
      TrueSheet.prototype.dismiss.apply(this, args)
    );
    render() {
      return ReactMock.createElement(
        View,
        { style: this.props.style },
        this.props.children
      );
    }
  }

  TrueSheet.prototype.present = jest.fn(() => Promise.resolve());
  TrueSheet.prototype.dismiss = jest.fn(() => Promise.resolve());

  return { TrueSheet };
});

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

jest.mock("@rn-primitives/switch", () => {
  const ReactMock = require("react");
  const { Pressable, View } = require("react-native");

  const Root = ({ checked, onCheckedChange, children, ...props }: any) =>
    ReactMock.createElement(
      Pressable,
      {
        ...props,
        accessibilityRole: "switch",
        accessibilityState: { checked },
        onPress: () => onCheckedChange?.(!checked),
      },
      children
    );

  const Thumb = (props: any) => ReactMock.createElement(View, props);

  return {
    Root,
    Thumb,
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

jest.mock("react-native-pager-view", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");

  class PagerView extends ReactMock.Component {
    setPage = jest.fn();
    setPageWithoutAnimation = jest.fn();
    setScrollEnabled = jest.fn();
    render() {
      return ReactMock.createElement(View, this.props, this.props.children);
    }
  }

  return {
    __esModule: true,
    default: PagerView,
  };
});
