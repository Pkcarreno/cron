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

jest.mock("react-native-reanimated", () =>
  jest.requireActual("react-native-reanimated/mock")
);

jest.mock("react-native-audio-api", () =>
  jest.requireActual("react-native-audio-api/mock")
);

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
  const React = require("react");
  const { View } = require("react-native");

  class PagerViewMock extends React.Component<any, any> {
    setPage = jest.fn((selectedPage: number) => {
      this.props.onPageSelected?.({
        nativeEvent: { position: selectedPage },
      });
    });
    setPageWithoutAnimation = jest.fn((selectedPage: number) => {
      this.props.onPageSelected?.({
        nativeEvent: { position: selectedPage },
      });
    });
    setScrollEnabled = jest.fn();

    render() {
      return React.createElement(
        View,
        {
          ...this.props,
          style: this.props.style,
          testID: this.props.testID,
        },
        this.props.children
      );
    }
  }

  return {
    PagerView: PagerViewMock,
    __esModule: true,
    default: PagerViewMock,
  };
});
