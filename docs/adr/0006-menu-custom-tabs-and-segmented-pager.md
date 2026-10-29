# ADR 0006: High-Performance Segmented Pager and Direct Manipulation Custom Tabs

- **Status**: Accepted
- **Date**: October 2026
- **Context**: React Native 0.88.0, Expo SDK 58 (`58.0.16`), New Architecture (Fabric), React 19 (`19.3.0`), Reanimated 4 (`4.7.1`), Jotai 2 (`2.19.1`), `react-native-pager-view` (`9.0.7`)

## Context

The primary entry point of `cron` (`screens/menu`) allows users to select between five workout modes (`FOR TIME`, `AMRAP`, `INTERVAL`, `EMOM`, `STOP WATCH`). Following the upgrade to Expo SDK 58 and React Native 0.88 (New Architecture / Fabric / React 19), rapid page transitions exhibited severe synchronization bugs:

1. **Dual Reference & Echo Loops**: Duplicate instances of `currentIndexRef` across `index.tsx` and `use-form-pager.tsx` caused stale-reference evaluations during swipe gestures. When parent state updated, an effect fired imperative `pagerRef.current?.setPage()` calls mid-gesture, fighting with native momentum deceleration and snapping backwards.
2. **Fabric / React 19 Command Incompatibilities**: `dispatchCommand` threw warnings when invoking `setPage` on refs wrapped by Reanimated's `createAnimatedComponent(PagerView)`.
3. **Yoga Layout Thrashing**: The previous implementation animated flex `width` per frame (`AnimatedTabWrapper`) across sibling tabs, forcing full layout recalculations 60–120 times per second and causing visual jitter.
4. **Missing Direct Manipulation Affordance**: In user testing, athletes instinctively attempted to drag the top segmented pill to change modes, but the bar remained frozen because it lacked gesture handling.
5. **Redundant Dropdown & Coupled Footer**: An in-pill dropdown (`CaretDownIcon`) duplicated already visible options, and the Start button was tightly coupled inside the pager as an absolute child with runtime `onLayout` measurements.

## Decision

We rebuild the custom tab navigation and workout mode pager from the ground up as a **Passive Segmented Pager** with **Direct Manipulation Tab Scrubbing**:

### 1. Passive Unidirectional Native Pager

- **Engine**: Retain `react-native-pager-view` (backed by native `ViewPager2` on Android and `UIPageViewController` on iOS) to guarantee minimal GPU/CPU overhead and native edge-bounce physics on low-end hardware.
- **Unidirectional Event Flow**:
  - `onPageScroll` streams continuous position offsets directly to a Reanimated `SharedValue` (`scrollPosition`) on the UI runtime.
  - The gesture does **not** trigger React re-renders during active tracking.
  - React/Jotai state (`activeTimerModeAtom`) is committed strictly once upon gesture completion (`onPageSelected`).
  - An `isProgrammaticTransition` lock suppresses duplicate `setPage` commands and silences intermediate haptics during multi-page jumps.

### 2. Segment Scrubbing (Direct Manipulation on Tab Bar)

- In accordance with Apple Design (§2 _Direct Manipulation_), the top tab bar gains a dedicated `Gesture.Pan()` handler alongside a `Gesture.Tap()` detector.
- Touching and dragging along the tab track moves the indicator pill directly under the user's finger.
- Crossing tab detents emits a light tactile tick (`Haptics.selectionAsync()`).
- Releasing the gesture snaps magnetically to the nearest tab and smoothly animates the underlying `PagerView` to that mode.

### 3. Absolute Indicator with Pure 1:1 Interpolation

- **Elimination of In-Flow Width Animation**: All tab labels reside inside a static track with fixed typography metrics.
- **Floating Absolute Pill**: The white selection pill is positioned absolutely above the track. Its `transform: [{ translateX }]` and `width` are continuously derived from `scrollPosition` via pure linear interpolation without secondary spring bounce loops, eliminating layout thrashing and premature animation resumption.
- **Dropdown Removal**: The `CaretDownIcon` and dropdown menu are removed, maximizing horizontal clarity and typographic elegance.

### 4. Floating Action Dock & Decoupled State

- **Independent Screen Footer**: The workout "Start" button and settings gear are moved outside `FormPager` into a screen-level Floating Action Dock with a subtle gradient mask (`transparent` to `black`).
- **Edge-to-Edge Forms**: Form pages in `PagerView` render 100% edge-to-edge, with vertical `ScrollView`s utilizing comfortable bottom content padding (`paddingBottom: 96`) to scroll seamlessly beneath the floating dock.
- **Jotai Atom Isolation**: The active mode is stored in `activeTimerModeAtom`. Individual workout forms subscribe strictly to their own workout config atoms, preventing menu-wide re-render cascades.

## Consequences

- **Positive**:
  - Eliminates the stale-reference snapping glitch during rapid swiping and multi-tab taps.
  - Guarantees true 120fps UI-thread animation with zero Yoga layout passes per frame.
  - Solves the user testing confusion by enabling direct dragging/scrubbing on the top tab pill.
  - Preserves optimal battery and memory footprint on low-end Android devices by utilizing native ViewPager2.
  - Restores clean React 19 component composition without prop-drilled render functions or `onLayout` cascades.
- **Negative**:
  - Modifying tab label strings in the future requires updating precomputed geometry constants in code rather than relying on automatic runtime measurement.
