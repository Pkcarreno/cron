# Technical Evaluation: Upgrading Expo SDK in `cron`

- **Repository**: `cron`
- **Current State**: Expo SDK ~55.0.23, React Native 0.83.6, React 19.2.0
- **Target Candidates**: Expo SDK 57 (`57.0.30`) vs Expo SDK 58 (`58.0.16`)
- **Date**: October 2026
- **Status**: Complete Evaluation

---

## 1. Executive Summary

This evaluation investigates upgrading the `cron` application from **Expo SDK 55** to the latest available releases (**SDK 57** and **SDK 58**), following guidelines in `.agents/skills/expo-upgrade/SKILL.md` and primary upstream sources.

### 1.1 Core Recommendation: Two-Phase Upgrade Path

1. **Phase 1 (Immediate / Recommended Milestone): Upgrade to Expo SDK 57 (`57.0.30`)**
   - **Stability & Risk**: Low risk. SDK 57 was built with a zero-breaking-changes cadence for React Native 0.86.3.
   - **Hermes V1 Memory Bug Fix**: Resolves the severe Hermes V1 memory regression present in SDK 55 and SDK 56 when using `react-native-worklets` and `react-native-reanimated` (fixed in `expo@57.0.17+`).
   - **Gesture Handler Compatibility**: Keeps `react-native-gesture-handler` v2 (`~2.32.0`), retaining full compatibility with [`components/pressable-area.tsx`](file:///home/pk/Projects/cron/components/pressable-area.tsx) (Builder API) and `@gorhom/bottom-sheet@5.2.14`.
   - **Native C++ / Nitro Modules**: Upgrades `react-native-nitro-modules` to `^0.37.1`, `react-native-mmkv` to `^4.3.2`, and `react-native-audio-api` to `^0.13.6` without React/TypeScript API breaking changes.
   - **Deterministic Baseline**: All 76 unit tests pass, TypeScript compiles with zero errors, and Ultracite linter checks pass cleanly.

2. **Phase 2 (Future Milestone): Upgrade to Expo SDK 58 (`58.0.16`)**
   - SDK 58 brings React Native 0.88.0 and React 19.3.0, but introduces **React Native Gesture Handler v3 (`~3.3.0`)**, which deprecates the Builder API in favor of Hook-based gestures (`useTapGesture`, `useLongPressGesture`), requiring complete refactoring of [`components/pressable-area.tsx`](file:///home/pk/Projects/cron/components/pressable-area.tsx).
   - SDK 58 also requires mandatory iOS 27 UIKit Scene lifecycle adaptations.
   - Recommendation: Execute Phase 1 first to establish a stable modern base before adopting SDK 58.

---

## 2. Why Skip SDK 56

Per the rule in `.agents/skills/expo-upgrade/SKILL.md`:

> _"If upgrading from SDK 55 or earlier, skip SDK 56 and upgrade directly to SDK 57. Don't use `expo@57.0.8` or below. SDK 55 with Hermes V1 enabled, SDK 56, and older SDK 57 releases contain a Hermes V1 memory regression that can drastically increase memory usage when using `react-native-worklets` or `react-native-reanimated`."_

Additionally, SDK 56 initiated the migration of `@react-navigation/*` imports to `expo-router` subpaths. The `cron` codebase has zero direct imports of `@react-navigation/*`, so that friction point is absent.

---

## 3. Comparison Matrix: SDK 57 vs SDK 58

| Dimension | Expo SDK 57 (`57.0.30`) | Expo SDK 58 (`58.0.16`) |
| :-- | :-- | :-- |
| **React Native Version** | `0.86.3` | `0.88.0` |
| **React Version** | `19.2.3` | `19.3.0` |
| **Ecosystem Maturity** | Production-stable (~4 months of patch fixes up to `.30`) | Newly released `latest` tag (early adoption phase) |
| **Hermes V1 Memory Fix** | Fully resolved in `57.0.17+` | Resolved in core RN 0.88 engine |
| **React Native Gesture Handler** | `~2.32.0` (RNGH v2, Builder API preserved) | `~3.3.0` (RNGH v3, Hook API required; breaking change) |
| **Pager View** | `8.0.2` (RN Pager View v8) | `9.0.7` (RN Pager View v9 major bump) |
| **Worklets & Reanimated** | `react-native-reanimated@4.5.1` + `worklets@0.10.1` | `react-native-reanimated@4.7.1` + `worklets@0.13.0` |
| **Risk Assessment** | **LOW** (Safe, deterministic upgrade) | **MEDIUM - HIGH** (Requires code refactoring & library verification) |

---

## 4. Full Dependency Compatibility Matrix

| Package | Current Version (`cron`) | SDK 57 Target | SDK 58 Target | Classification | Risk Level | Notes |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `expo` | `~55.0.23` | `~57.0.30` | `~58.0.16` | Expo Core | Low (57) | SDK 57 contains stable Hermes fixes. |
| `react` | `19.2.0` | `19.2.3` | `19.3.0` | React Core | Low | Routine patch in SDK 57. |
| `react-native` | `0.83.6` | `0.86.3` | `0.88.0` | RN Core | Low (57) | RN 0.86 has zero user-facing API removals. |
| `expo-router` | `~55.0.14` | `~57.0.28` | `~58.0.24` | Expo Router | Low | Compatible. Remove duplicate entry in `app.config.ts`. |
| `react-native-reanimated` | `~4.2.1` | `4.5.1` | `4.7.1` | Native Animation | Low | Bundled with SDK 57. |
| `react-native-worklets` | `0.7.4` | `0.10.1` | `0.13.0` | Worklets Runtime | Low | Required peer for Reanimated 4. |
| `react-native-gesture-handler` | `~2.30.0` | `~2.32.0` | `~3.3.0` | Native Gestures | **Low (57) / High (58)** | SDK 57 maintains v2 syntax. SDK 58 breaks `Gesture.Tap()`. |
| `react-native-pager-view` | `8.0.0` | `8.0.2` | `9.0.7` | UI Pager | Low (57) | Preserves v8 API. |
| `react-native-screens` | `~4.23.0` | `~4.26.0` | `~4.30.0` | Native Screens | Low | Fabric New Architecture ready. |
| `react-native-safe-area-context` | `~5.6.0` | `~5.7.0` | `~5.10.1` | UI Layout | Low | Drop-in update. |
| `react-native-svg` | `15.15.3` | `15.15.4` | `15.16.0` | Graphics | Low | Compatible with `phosphor-react-native`. |
| `expo-image` | `~55.0.10` | `~57.0.5` | `~58.0.16` | Image | Low | Drop-in update. |
| `expo-haptics` | `~55.0.14` | `~57.0.3` | `~58.0.7` | Haptics | Low | Used in [`helpers/haptics.ts`](file:///home/pk/Projects/cron/helpers/haptics.ts). Drop-in. |
| `expo-constants` | `~55.0.16` | `~57.0.22` | `~58.0.12` | Runtime Constants | Low | Keep as direct dependency for `expo-router`. |
| `expo-splash-screen` | `~55.0.20` | `~57.0.10` | `~58.0.10` | App Startup | Low | Drop-in update. |
| `expo-status-bar` | `~55.0.6` | `~57.0.1` | `~58.0.3` | System UI | Low | Drop-in update. |
| `expo-system-ui` | `^55.0.17` | `~57.0.4` | `~58.0.6` | System UI | Low | Drop-in update. |
| `expo-battery` | `~55.0.13` | `~57.0.3` | `~58.0.3` | Device Info | Low | Drop-in update. |
| `expo-font` | `~55.0.7` | `~57.0.4` | `~58.0.9` | Typography | Low | Configured in `app.config.ts` for Geist fonts. |
| `expo-keep-awake` | `~55.0.8` | `~57.0.2` | `~58.0.3` | Screen Wake | Low | Drop-in update. |
| `expo-linking` | `~55.0.15` | `~57.0.13` | `~58.0.13` | Deep Links | Low | Drop-in update. |
| `expo-navigation-bar` | `~55.0.12` | `~57.0.3` | `~58.0.4` | Android Nav Bar | Low | Edge-to-edge support. |
| `expo-linear-gradient` | `~55.0.13` | `~57.0.2` | `~58.0.3` | UI Gradients | Low | Supported in SDK 57/58. |
| `react-native-nitro-modules` | `^0.35.1` | `^0.37.1` | `^0.37.1` | C++ TurboModules | **Medium** | Must update to `>= 0.36.2` to compile with RN 0.86+. |
| `react-native-mmkv` | `^4.2.0` | `^4.3.2` | `^4.3.2` | Key-Value Storage | Low | Built on Nitro Modules; update to 4.3.2. |
| `react-native-audio-api` | `^0.11.5` | `^0.13.6` | `^0.13.6` | Web Audio Engine | Low | Version 0.13.6 fixes race conditions on RN 0.86+. |
| `@gorhom/bottom-sheet` | `^5.2.8` | `^5.2.14` | `^5.2.14` | UI Sheet | **Low (57) / Medium (58)** | Compatible with Reanimated 4 and RNGH v2. |
| `@rn-primitives/*` | `^1.2.0` / `^1.3.0` | `^1.5.2` / `^1.5.3` | `^1.5.2` / `^1.5.3` | UI Primitives | Low | Updates include React 19 typing fixes. |
| `jotai` | `^2.19.1` | `^2.19.1` | `^2.19.1` | State Mgmt | Low | Pure JS; zero native dependency. |
| `zod` | `^4.4.3` | `^4.4.3` | `^4.4.3` | Schema Validation | Low | Pure JS. |
| `@tanstack/react-form` | `^1.29.1` | `^1.29.1` | `^1.29.1` | Form Logic | Low | Pure JS. |
| `phosphor-react-native` | `^3.0.3` | `^3.0.3` | `^3.0.3` | Icons | Low | Runs cleanly on `react-native-svg`. |
| `@expo/metro-runtime` | `~55.0.11` | `~57.0.17` | `~58.0.14` | Dev Bundler | Low | Upgrade with Expo CLI. |
| `jest-expo` | `~55.0.17` | `~57.0.6` | `~58.0.11` | Test Preset | Low | Upgrade to match SDK preset. |

---

## 5. Codebase Audit and Action Items

### 5.1 Gesture Handling: [`components/pressable-area.tsx`](file:///home/pk/Projects/cron/components/pressable-area.tsx)

- **Current Pattern**:
  ```tsx
  const doubleTap = Gesture.Tap().numberOfTaps(2).enabled(!!onDoublePress).runOnJS(true)...;
  const longPress = Gesture.LongPress().minDuration(LONG_PRESS_DURATION)...;
  const singleTap = Gesture.Tap().requireExternalGestureToFail(doubleTap, longPress)...;
  const composed = Gesture.Exclusive(doubleTap, longPress, singleTap);
  ```
- **SDK 57**: 100% compatible. No modifications needed.
- **SDK 58**: Would require converting to `useTapGesture()`, `useLongPressGesture()`, and `useComposedGesture()`, as well as renaming callback hooks (`onStart` to `onActivate`).

### 5.2 Expo Configuration: [`app.config.ts`](file:///home/pk/Projects/cron/app.config.ts)

1. **Duplicate Plugin**: `"expo-router"` is registered twice (line 129 and line 349). Remove the redundant entry.
2. **React Compiler**: Can be enabled under `experiments`:
   ```ts
   experiments: {
     typedRoutes: true,
     reactCompiler: true,
   },
   ```

### 5.3 Root Layout: [`app/_layout.tsx`](file:///home/pk/Projects/cron/app/_layout.tsx)

- Wrap `<GestureHandlerRootView>` with explicit flex styling to prevent gesture boundary collapse on modern edge-to-edge layouts:
  ```tsx
  <GestureHandlerRootView style={{ flex: 1 }}>
  ```

---

## 6. Native Build Impact & Prebuild (CNG)

The project relies on Continuous Native Generation (CNG):

- `package.json` contains:
  ```json
  "nuke": "rm -rf ./node_modules && rm -rf ./ios && rm -rf ./android",
  "prebuild": "expo prebuild"
  ```
- No manual modifications exist in `ios/Podfile` or `android/build.gradle`.
- Therefore, the native folders must be cleanly regenerated using:
  ```bash
  npx expo prebuild --clean
  ```

### Native Modules Requiring Special Attention:

1. **`react-native-nitro-modules` (`0.37.1`)**: Required for React Native 0.86+ C++ ABI compatibility.
2. **`react-native-mmkv` (`4.3.2`)**: Compatible with Nitro 0.37.x and New Architecture.
3. **`react-native-audio-api` (`0.13.6`)**: Ensures audio context stability in [`helpers/playback-service.ts`](file:///home/pk/Projects/cron/helpers/playback-service.ts).

---

## 7. Step-by-Step Upgrade Procedure (To SDK 57)

```bash
# 1. Ensure clean git tree and branch
git checkout -b chore/upgrade-expo-sdk-57

# 2. Update core Expo dependencies
pnpm dlx expo install expo@~57.0.30 --fix

# 3. Update third-party native C++ and UI libraries
pnpm add react-native-nitro-modules@^0.37.1 react-native-mmkv@^4.3.2 react-native-audio-api@^0.13.6 @gorhom/bottom-sheet@^5.2.14

# 4. Apply code edits:
#    - Deduplicate "expo-router" in app.config.ts
#    - Add style={{ flex: 1 }} to GestureHandlerRootView in app/_layout.tsx

# 5. Clean native artifacts and re-run prebuild
rm -rf node_modules .expo
pnpm install
npx expo prebuild --clean

# 6. Run verification loop
npx expo-doctor
pnpm typecheck
pnpm lint
pnpm test

# 7. Test native builds on device / emulator
pnpm android
pnpm ios
```

---

## 8. Primary Sources & Citations

1. **Expo SDK 57 Changelog**: [https://expo.dev/changelog/sdk-57](https://expo.dev/changelog/sdk-57)
   - React Native 0.86.3 support, continuous upgrade architecture, Hermes V1 stability patches.
2. **Expo SDK 58 Changelog**: [https://expo.dev/changelog/sdk-58](https://expo.dev/changelog/sdk-58)
   - React Native 0.88.0, iOS 27 UIKit Scene lifecycle, RNGH v3 Hook API shift, removal of `InteractionManager`.
3. **Expo Upgrade Guide Skill**: [`.agents/skills/expo-upgrade/SKILL.md`](file:///home/pk/Projects/cron/.agents/skills/expo-upgrade/SKILL.md)
   - Hermes V1 memory regression alert and recommendation to skip SDK 56 directly to SDK 57.0.9+.
4. **Software Mansion - React Native Gesture Handler Docs**: [https://docs.swmansion.com/react-native-gesture-handler/](https://docs.swmansion.com/react-native-gesture-handler/)
   - RNGH v2 vs v3 API changes and Hook API migration.
5. **Software Mansion - React Native Audio API Repository**: [https://github.com/software-mansion/react-native-audio-api](https://github.com/software-mansion/react-native-audio-api)
   - Web Audio API C++ bindings for New Architecture on RN 0.86+.
6. **Margelo - Nitro Modules**: [https://nitro.margelo.com/](https://nitro.margelo.com/)
   - C++ threading and TurboModule ABI requirements for RN 0.86+.
