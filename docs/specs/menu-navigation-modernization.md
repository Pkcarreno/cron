# Specification: Menu Navigation Modernization (Fluid UX & 120fps Performance)

- **Feature Branch:** `feat/menu-navigation-fluid-ux`
- **Target Files:**
  - [`screens/menu/components/form-pager/index.tsx`](file:///home/pk/Projects/cron/screens/menu/components/form-pager/index.tsx)
  - [`screens/menu/components/form-pager/use-form-pager.tsx`](file:///home/pk/Projects/cron/screens/menu/components/form-pager/use-form-pager.tsx)
  - [`screens/menu/components/form-pager/components/animated-tab.tsx`](file:///home/pk/Projects/cron/screens/menu/components/form-pager/components/animated-tab.tsx)
  - [`screens/menu/components/form-pager/components/utils.tsx`](file:///home/pk/Projects/cron/screens/menu/components/form-pager/components/utils.tsx)
  - [`screens/menu/components/form-pager/shared.ts`](file:///home/pk/Projects/cron/screens/menu/components/form-pager/shared.ts)
  - [`screens/menu/index.tsx`](file:///home/pk/Projects/cron/screens/menu/index.tsx)
  - [`screens/menu/hooks/use-timer-form.tsx`](file:///home/pk/Projects/cron/screens/menu/hooks/use-timer-form.tsx)
  - [`screens/menu/index.test.tsx`](file:///home/pk/Projects/cron/screens/menu/index.test.tsx)
- **ADR Reference:** [ADR 0005: Menu Navigation Modernization](file:///home/pk/Projects/cron/docs/adr/0005-menu-navigation-modernization.md)
- **Research Reference:** [Research: Menu Navigation Performance, UX Affordances, and Architecture](file:///home/pk/Projects/cron/docs/research/menu-navigation-performance-ux-and-architecture.md)

---

## 1. Functional Specifications

### 1.1 Direct Manipulation Header Dragging (UX Affordance)

- **G1.1 (Track Pan Gesture):** The top tab bar container must be wrapped in a `Gesture.Pan()` handler from `react-native-gesture-handler`.
- **G1.2 (Continuous 1:1 Tracking):** As the user drags horizontally across the header, the animated value `scrollPosition` must update continuously in real-time (1:1 with finger displacement) on the UI thread without crossing the bridge.
- **G1.3 (Projection & Snap):** Upon releasing the drag gesture, the coordinator must calculate target landing based on position and release velocity ($v_x$). The active index must settle on `Math.round(clampedTarget)` and command the pager view to transition to that page.
- **G1.4 (Rubber-banding at Bounds):** Dragging past the first tab (index `< 0`) or past the last tab (index `> N - 1`) must apply elastic resistance (damping factor ~`0.35`). Releasing beyond the bounds must spring back to the boundary index with critical damping (`damping: 1.0`).
- **G1.5 (Tap on Inactive Tab):** Tapping any inactive tab must immediately navigate to that tab with an Apple-calibrated spring transition.

### 1.2 Hitbox Disambiguation & Mode Dropdown

- **G2.1 (Isolated Dropdown Trigger):** The `DropdownMenuTrigger` must not enclose the entire active pill. It must be isolated strictly to the right chevron button (`CaretDownIcon`) with an accessible touch hit-target (minimum 44×44pt).
- **G2.2 (Unimpeded Pill Drag):** Placing a finger on the label text of the active tab must initiate a horizontal pan gesture rather than opening the dropdown menu.
- **G2.3 (Chevron Animation):** When the dropdown menu opens or closes, the chevron must rotate 180° using a spring curve (`damping: 1.0`, `stiffness: 300`) rather than a fixed linear duration.

### 1.3 Tactile Haptic Feedback

- **G3.1 (Threshold Crossings):** When dragging the header or the pager across an integer tab boundary, trigger a subtle haptic pulse (`AndroidHaptics.Segment_Tick` / `ImpactFeedbackStyle.Light`).
- **G3.2 (Settling Feedback):** When a new tab becomes active and settles, trigger confirmation feedback without redundant repeated haptics.

---

## 2. Technical Specifications & Architecture

### 2.1 State Synchronization & Infinite Loop Prevention

- **T1.1 (Single Authority Ref):** All page index synchronization must be centralized in `useFormPager`. Remove the duplicated `currentIndexRef` and duplicate `useEffect` from `form-pager/index.tsx`.
- **T1.2 (Scroll State Guard):** Track native scroll state via `onPageScrollStateChanged` (`idle`, `dragging`, `settling`). Programmatic calls to `pagerRef.current?.setPage(newIndex)` must only execute when:
  1. The external `value` prop changed to an index different from the current settled index, AND
  2. The pager state is `idle` (preventing fighting against an active user drag).
- **T1.3 (Fabric Ref Compatibility):** Replace `const AnimatedPagerView = createAnimatedComponent(PagerView);` with standard `PagerView`. Do not wrap `PagerView` in `createAnimatedComponent` since no animated style/prop is applied to the container itself. Use direct native ref forwarding to eliminate Fabric `dispatchCommand` errors.

### 2.2 Fluid Stretch Pill Animation (Emil Kowalski Philosophy on GPU)

- **T2.1 (Zero Yoga Layout Passes):** Tab titles must be rendered in a static row with fixed layout widths (measured once on initial layout or initialized with deterministic defaults).
- **T2.2 (Floating Pill Transform):** The active highlight pill must be rendered as an absolutely positioned view (`position: "absolute"`, `pointerEvents: "box-none"`).
- **T2.3 (Velocity Stretch):**
  - Pill X-position is animated via `transform: [{ translateX }]` derived from interpolated center coordinates of measured tabs.
  - Directional stretching is achieved via `transform: [{ scaleX }]` proportional to gesture velocity ($v_x$) and scroll offset delta, clamped to a maximum stretch of `1.15x`.
  - When the gesture ends or the pager settles, `scaleX` springs back to `1.0` with `damping: 1.0` and `stiffness: 320`.
- **T2.4 (Active Text Contrast Masking):** Active text styling is either handled via color interpolation worklet or a dual-layer clipped track, ensuring text under the white pill is black and inactive text is muted gray (`neutral[400]`).

### 2.3 Virtual Windowing for Forms (Memory & CPU Optimization)

- **T3.1 (Window Boundary):** Only render form components for tabs within `|activeIndex - index| <= 1` (the active tab and its immediate left/right neighbors).
- **T3.2 (Distant Tab Fallback):** For tabs with `|activeIndex - index| > 1`, render a lightweight empty placeholder `View`.
- **T3.3 (Zero State Loss):** Because all form values, dirty flags, and validation states are backed by persistent Jotai atoms ([`forTimeWorkoutAtom`](file:///home/pk/Projects/cron/stores/workout.ts), [`amrapWorkoutAtom`](file:///home/pk/Projects/cron/stores/workout.ts), [`emomWorkoutAtom`](file:///home/pk/Projects/cron/stores/workout.ts), [`intervalWorkoutAtom`](file:///home/pk/Projects/cron/stores/workout.ts), [`stopWatchWorkoutAtom`](file:///home/pk/Projects/cron/stores/workout.ts)), unmounting off-screen tabs releases DOM/Fabric memory without losing any user edits.
- **T3.4 (Stable Footer Inset):** Eliminate the inline function recreation `option.content({ bottom: footerHeight + 12 })`. Provide `footerHeight` via a stable React Context or memoized configuration to prevent re-rendering all forms on footer layout passes.

---

## 3. Test & Verification Plan

### 3.1 Unit & Integration Tests (`screens/menu/index.test.tsx`)

1. **Loop Prevention Test:** Assert that rapid switching between tabs does not trigger infinite render cycles or multiple calls to `setPage`.
2. **Fabric Command Dispatch Test:** Verify that `setPage` executes cleanly without `dispatchCommand was called with a ref that isn't a native component` console warnings.
3. **Tab Bar Header Interaction:** Verify that tapping inactive tabs triggers navigation and updates the active mode in the store/parent.
4. **Dropdown Chevron Isolation:** Verify that pressing the chevron button opens the dropdown menu, while pressing or dragging the active tab text does not.
5. **Form State Preservation:** Verify that input entered in tab 0 is intact when switching to tab 3 and returning to tab 0 (verifying virtual windowing).
6. **Regression Suite:** All existing tests in `screens/menu/index.test.tsx` (Start navigation, schema validation, preset updates) must continue passing with 100% green status.

### 3.2 Linter & Typecheck Standards

- `pnpm lint` (`ultracite check`) must pass with 0 errors and 0 warnings.
- `pnpm typecheck` (`tsc --noEmit`) must pass with 0 errors.
