/* oxlint-disable eslint/class-methods-use-this, eslint/no-empty-function, node/global-require, unicorn/prefer-module, typescript/no-explicit-any, eslint/max-classes-per-file */
import "react-native-gesture-handler/jestSetup";

const {
  createJSReanimatedModule,
} = require("react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated");

createJSReanimatedModule().constructor.prototype.setCSSEventHandler = () => {};

const { StyleSheet } = require("react-native");

if (!StyleSheet.absoluteFillObject) {
  StyleSheet.absoluteFillObject = {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  };
}

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
    static lastProps: any = undefined;

    present: any = jest.fn((...args: any[]): Promise<any> =>
      TrueSheet.prototype.present.apply(this, args)
    );
    dismiss: any = jest.fn((...args: any[]): Promise<any> =>
      TrueSheet.prototype.dismiss.apply(this, args)
    );
    resize: any = jest.fn((...args: any[]): Promise<any> =>
      TrueSheet.prototype.resize.apply(this, args)
    );
    dismissStack: any = jest.fn((...args: any[]): Promise<any> =>
      TrueSheet.prototype.dismissStack.apply(this, args)
    );
    render() {
      TrueSheet.lastProps = this.props;
      return ReactMock.createElement(
        View,
        {
          testID: this.props.testID ?? "mock-true-sheet",
          ...this.props,
          style: this.props.style,
        },
        this.props.children
      );
    }
  }

  TrueSheet.prototype.present = jest.fn(() => Promise.resolve());
  TrueSheet.prototype.dismiss = jest.fn(() => Promise.resolve());
  TrueSheet.prototype.resize = jest.fn(() => Promise.resolve());
  TrueSheet.prototype.dismissStack = jest.fn(() => Promise.resolve());

  return {
    TrueSheet,
    TrueSheetOverlay: ({ children, ...rest }: any) =>
      ReactMock.createElement(View, rest, children),
    TrueSheetPeek: ({ children, ...rest }: any) =>
      ReactMock.createElement(View, rest, children),
    TrueSheetProvider: ({ children }: any) => children,
    useTrueSheet: () => ({
      dismiss: jest.fn(() => Promise.resolve()),
      dismissAll: jest.fn(() => Promise.resolve()),
      dismissStack: jest.fn(() => Promise.resolve()),
      present: jest.fn(() => Promise.resolve()),
      resize: jest.fn(() => Promise.resolve()),
    }),
  };
});

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

jest.mock("expo-blur", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");

  const BlurView = ReactMock.forwardRef((props: any, ref: any) =>
    ReactMock.createElement(
      View,
      {
        ...props,
        ref,
      },
      props.children
    )
  );
  BlurView.displayName = "BlurView";

  const BlurTargetView = ReactMock.forwardRef((props: any, ref: any) =>
    ReactMock.createElement(
      View,
      {
        ...props,
        ref,
      },
      props.children
    )
  );
  BlurTargetView.displayName = "BlurTargetView";

  return {
    BlurTargetView,
    BlurView,
    __esModule: true,
    default: BlurView,
  };
});
