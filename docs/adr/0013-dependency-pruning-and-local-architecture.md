# ADR 0013: Dependency Pruning, Local Primitives, and Direct State Architecture

- **Status**: Accepted
- **Date**: November 2026
- **Context**: React Native 0.88.0, Expo SDK 58 (`58.0.16`), New Architecture (Fabric & TurboModules), React 19 (`19.3.0`), Jotai (`2.19.1`), `react-native-svg` (`15.16.0`), `react-native-mmkv` (`4.3.2`), `@lodev09/react-native-true-sheet` (`3.11.18`).

---

## 1. Context & Problem Statement

As `cron` matured through Expo SDK 58 and React Native 0.88 (Fabric / React 19 New Architecture), an audit of external dependencies revealed creeping complexity, bundle inflation, and runtime friction caused by third-party abstractions that superseded standard React Native primitives:

1. **Third-Party UI Component Wrappers (`@rn-primitives`)**:
   - The `@rn-primitives/switch` library was used solely for toggle controls in `screens/settings`.
   - It introduced an external dependency tree, extra DOM/portal abstraction layers, and mock burdens in unit testing (`jest.setup.ts`), despite React Native providing robust, accessible touch primitives (`Pressable`).
2. **Heavy Image Caching Pipeline (`expo-image`)**:
   - The application is a minimalist vector-first chronometer. The only non-vector graphic asset was the brand mark (`components/logo.tsx`), which loaded a static SVG via `<Image source={require("./logo.svg")} />` from `expo-image`.
   - `expo-image` pulls heavy native image caching engines (Glide on Android, SDWebImage on iOS) into the application binary, along with native plugin hooks in `app.config.ts`, increasing native binary sizes for an app that renders zero dynamic raster imagery.
3. **External Icon Bundles (`phosphor-react-native`)**:
   - The app imported an entire icon library package (`phosphor-react-native`) to render exactly three icons across the entire interface: `CaretRight` (navigation links), `BellSlash` (notification permission banner), and `Sliders` (settings dock trigger).
   - This imposed unnecessary dependency management, Dependabot noise, and version locking overhead.
4. **Redundant Form Management Engines (`@tanstack/react-form`)**:
   - Workout configuration screens (`AMRAP`, `EMOM`, `FOR TIME`, `INTERVAL`) utilized `@tanstack/react-form` alongside Jotai.
   - TanStack Form introduced complex form context providers, nested field state machines, and bidirectional synchronization effects (`useEffect` sync loops between form state and Jotai atoms).
   - This pattern violated React 19 and New Architecture guidelines by introducing cascading re-renders and unnecessary reconciliation layers for simple numeric inputs already bound to atomic state.

---

## 2. Decision & Architecture

We adopt a lean, zero-fluff architecture by eliminating unnecessary dependencies, migrating to local primitives, and establishing strict engineering boundaries for future features.

### 2.1. Dependency Elimination & Local Migrations

1. **Elimination of `@rn-primitives` in favor of Local Accessible Primitives**:
   - Replaced `@rn-primitives/switch` with a zero-dependency local component (`components/switch.tsx`) composed of React Native `Pressable` and `Animated` (or Reanimated).
   - Fully supports native accessibility attributes (`accessibilityRole="switch"`, `accessibilityState={{ checked }}`), keyboard focus, and tokenized styling.
   - Cleans up unit test setups by removing mock definitions.

2. **Elimination of `expo-image` and Native Image Pipelines**:
   - Converted the brand mark in `components/logo.tsx` to a native vector component powered directly by `react-native-svg` (`Svg`, `Path`).
   - Removed `expo-image` from `package.json` and deleted the `"expo-image"` config plugin from `app.config.ts`.
   - Native builds no longer compile or link SDWebImage (iOS) or Glide (Android), resulting in smaller APK/IPA sizes and faster compile times.

3. **Elimination of `phosphor-react-native` via Local Vector Glyphs**:
   - Extracted the three active vector glyphs into dedicated local SVG components under `components/icons/`:
     - `CaretRightIcon` (`components/icons/caret-right-icon.tsx`)
     - `BellSlashIcon` (`components/icons/bell-slash-icon.tsx`)
     - `SlidersIcon` (`components/icons/sliders-icon.tsx`)
   - All icons adhere to a unified SVG contract (`IconProps` in `components/icons/types.ts`) supporting `size`, `color`, and `strokeWidth`.
   - Removed `phosphor-react-native` and its entry in `.github/dependabot.yml`.

4. **Elimination of `@tanstack/react-form` via Direct Atomic State Binding**:
   - Completely uninstalled `@tanstack/react-form` and `@tanstack/form-core`.
   - Refactored all workout configuration forms (`AMRAP`, `EMOM`, `FOR TIME`, `INTERVAL`) to bind directly to their respective Jotai atoms in `stores/workout.ts`.
   - Retained declarative layout containers (`FieldSet`, `FieldGroup`, `Field`, `FieldLabel`) for uniform typography and spacing.
   - Input fields (`NumberField`, `TimeField`) directly dispatch atom updates on value changes, performing boundary validation (e.g., positive minimum constraints) without intermediate form state machines.
   - Eliminated bidirectional sync cycles and form context providers.

### 2.2. Reaffirmation of Core Dependencies

We explicitly reaffirm the retention of the following high-value native and architecture dependencies:

| Dependency | Purpose | Retention Justification |
| :-- | :-- | :-- |
| **`@lodev09/react-native-true-sheet`** | Bottom sheet presentation | True native modal presentation (`UISheetPresentationController` on iOS, Material `BottomSheetDialog` on Android). Zero JS gesture thread coupling, fully Fabric-compatible (ADR 0004). |
| **`react-native-audio-api`** | Audio engine | Direct hardware/WebAudio PCM buffer playback via C++ TurboModules. Guarantees deterministic, zero-latency workout beeps without JS thread interruption (ADR 0007). |
| **`jotai`** | State management | Granular atomic state model with bottom-up subscriptions. Enables per-second / per-minute leaf re-renders without invalidating parent component trees. |
| **`react-native-mmkv`** | Synchronous persistence | Ultra-fast C++ Nitro/TurboModule MMKV key-value storage for immediate state hydration and persistent settings without async storage flicker. |
| **`react-native-pager-view`** | Workout mode pager | Native `ViewPager2` (Android) and `UIPageViewController` (iOS) implementation providing hardware-accelerated paging with zero JS thread layout thrashing (ADR 0006). |
| **`react-native-svg`** | Vector graphics | Powers all screen displays, timer numerals, OLED-safe layouts, and iconography without raster scaling artifacts. |

---

## 3. Engineering Standards for Future Development

To prevent architectural regression, the following engineering invariants are established:

1. **Iconography Standard**:
   - Do **not** install general-purpose icon libraries (e.g., FontAwesome, Ionicons, MaterialIcons, Feather).
   - Any new icon must be authored as a clean, localized vector component using `react-native-svg` within `components/icons/`, matching the `IconProps` contract.
2. **Form and Input State Standard**:
   - Do **not** reintroduce external form libraries (`react-hook-form`, `formik`, `tanstack-form`).
   - Simple configuration forms must read and write directly to Jotai atoms or local React state.
   - Validation must occur at the field or picker boundary (`zod` or pure guard assertions).
3. **Dependency Onboarding Gate**:
   - Introducing any new dependency to `package.json` requires evaluating whether native primitives (`Pressable`, `View`, `Text`, `StyleSheet`) or existing installed libraries (`react-native-svg`, `reanimated`) can accomplish the goal with less than 100 lines of idiomatic code.
   - Any native module must provide explicit New Architecture (Fabric / TurboModule) compatibility.

---

## 4. Consequences

### Positive

- **Leaner Dependency Graph**: Removed 4 external packages and dozens of transitive dependencies (`@tanstack/react-form`, `@tanstack/form-core`, `expo-image`, `phosphor-react-native`, `@rn-primitives/*`).
- **Binary & Bundle Footprint**: Removed heavy third-party image caching engines from native builds and pruned JS bundle size.
- **Render Performance**: Removed bidirectional form sync cycles, eliminating unnecessary reconciliation passes in workout configuration tabs.
- **Maintainability & Stability**: Zero mock overhead in tests for switch primitives and icon bundles; all unit tests execute deterministically against local code.

### Negative

- New icon requirements require manual SVG path extraction into `components/icons/` rather than importing from a package.
