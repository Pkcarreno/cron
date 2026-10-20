# ADR 0002: Staged Upgrade to Expo SDK 57 Before SDK 58

## Context

Upgrading from Expo SDK 55 to modern releases requires navigating two major upstream constraints:

1. SDK 56 and unpatched SDK 57 releases contain a severe Hermes V1 memory regression when importing `react-native-worklets` or `react-native-reanimated`.
2. SDK 58 introduces React Native Gesture Handler v3, which deprecates the Builder API (`Gesture.Tap()`) used across our direct-manipulation timer components (`components/pressable-area.tsx`) and requires refactoring to Hook-based gestures.

## Decision

We adopt a two-phase upgrade roadmap:

- **Phase 1**: Upgrade immediately to Expo SDK 57 (`57.0.30`) with React Native 0.86.3 and Hermes V1 memory fixes (`expo@57.0.17+`). We upgrade native C++ TurboModules (`react-native-nitro-modules@^0.37.1`, `react-native-mmkv@^4.3.2`, `react-native-audio-api@^0.13.6`) while preserving the existing Gesture Handler v2 syntax.
- **Phase 2**: Once Phase 1 is validated in development builds, refactor gesture interactions in `components/pressable-area.tsx` to RNGH v3 and upgrade to Expo SDK 58 (`58.0.16`) with React Native 0.88.0.

## Consequences

- **Positive**:
  - Isolates native compilation and runtime variables from touch/gesture interaction refactoring.
  - Eliminates the Hermes V1 memory regression without introducing user-facing behavioral regressions.
  - Keeps 100% of existing unit tests, lint rules, and TypeScript typechecking passing deterministically.
- **Negative**:
  - Requires maintaining an intermediate upgrade state before achieving the ultimate goal of Expo SDK 58.
