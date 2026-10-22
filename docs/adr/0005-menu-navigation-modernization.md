# ADR 0005: Menu Navigation Modernization — Performance, UX Affordances, and Fluid Gestures

- **Status:** Accepted
- **Date:** 2026-10-22
- **Authors:** Pedro Carreño, Antigravity Agent
- **Deciders:** Pedro Carreño
- **Tags:** react-native, navigation, performance, reanimated, gestures, ux, emil-design-eng

---

## Context and Problem Statement

Following the upgrade to React Native 0.88 (React 19), Reanimated 4.7.1, and React Native Gesture Handler 3.3.0 on Fabric (New Architecture), the custom tab navigation in [`screens/menu`](file:///home/pk/Projects/cron/screens/menu) exhibited three critical defects:

1. **Tab-Switching Infinite Loop Bug:**
   - Double `currentIndexRef` desynchronization between [`use-form-pager.tsx`](file:///home/pk/Projects/cron/screens/menu/components/form-pager/use-form-pager.tsx) and [`form-pager/index.tsx`](file:///home/pk/Projects/cron/screens/menu/components/form-pager/index.tsx).
   - In Fabric, `createAnimatedComponent(PagerView)` broke native ref forwarding, throwing `dispatchCommand was called with a ref that isn't a native component` when invoking `setPage()`.
   - Native `onPageSelected` events and React state updates ping-ponged cyclically.

2. **Severe Frame Drops and CPU Overhead:**
   - Animating `width: baseWidth + extraWidth` continuously during swipes on in-flow flex children forced Yoga layout recalculations on every frame at 60/120Hz.
   - Measuring 5 tabs individually caused 5–10 cascading state updates on mount and flashed `opacity: 0`.
   - All 5 form screens ([`ForTimeForm`](file:///home/pk/Projects/cron/screens/menu/components/forms/for-time-form.tsx), [`AmrapForm`](file:///home/pk/Projects/cron/screens/menu/components/forms/amrap-form.tsx), [`IntervalForm`](file:///home/pk/Projects/cron/screens/menu/components/forms/interval-form.tsx), [`EmomForm`](file:///home/pk/Projects/cron/screens/menu/components/forms/emom-form.tsx), [`StopWatchForm`](file:///home/pk/Projects/cron/screens/menu/components/forms/stopwatch-form.tsx)) were eagerly mounted with active TanStack Form stores, Jotai subscriptions, and ScrollViews.
   - Inline `option.content({ bottom: footerHeight + 12 })` callbacks re-rendered all 5 forms whenever footer height changed.

3. **UX & Affordance Breakdown:**
   - The top tab bar visually resembles a draggable carousel, but its track swallowed touches (`Pressable` and `DropdownMenuTrigger`), ignoring horizontal drags.
   - Form fields in the body look like a vertical scrolling page, causing new users to attempt dragging the top bar instead. When that failed, users assumed horizontal navigation was impossible.

---

## Decision Drivers

- **Direct Manipulation (Apple Design):** Users must be able to drag the top tab bar directly with 1:1 tactile responsiveness.
- **120fps GPU Performance ($react-native-best-practices / $animate-expo):** Zero Yoga layout recalculations during motion. `transform` and `opacity` only.
- **Fluid Motion Signature (Emil Kowalski Philosophy):** Elastic pill stretching (_fluid stretch_) during gesture velocity and critically damped spring settlements (`damping: 1.0`).
- **Memory & Render Efficiency ($vercel-react-native-skills):** Virtualized tab windowing (`active ± 1`) leveraging Jotai persistent storage.
- **Robustness in React 19 / Fabric:** Elimination of conflicting refs, clean state guards (`onPageScrollStateChanged`), and proper native `PagerView` command dispatching.

---

## Considered Options & Decisions

### 1. Pager Engine (Q1)

- **Option A (Chosen):** Keep `react-native-pager-view` for the body container, stripping `createAnimatedComponent` wrapper to fix Fabric ref forwarding, and coordinate it with a top-bar `Gesture.Pan()`.
- **Option B (Rejected):** 100% custom RNGH Pan swipe canvas (reinventing native pagination physics and nested scroll handling across platforms).

### 2. Hitbox Disambiguation on Active Pill (Q2)

- **Option A (Chosen):** Physically separate the touch targets. The tab text responds to taps and horizontal drags; a dedicated hit-target button (min 44×44pt) holds the `CaretDownIcon` to trigger the `DropdownMenu`.
- **Option B (Rejected):** Gesture slop threshold heuristics.

### 3. Pill Motion & Layout Architecture (Q3 / Q3.1)

- **Option C (Chosen):** Emil Kowalski fluid stretch pill. Tab titles remain fixed in layout. The active white pill is an absolute, child-free floating view driven by `transform: [{ translateX }, { scaleX }]`. Velocity expands the pill in the movement direction, snapping into place with an Apple-calibrated spring (`damping: 1.0`, `stiffness: 300`).
- **Option A (Considered):** Static linear width interpolation.
- **Option B (Rejected):** Uniform-width segmented control.

### 4. Form Lifecycle & Memory Windowing (Q4)

- **Option A (Chosen):** Virtual windowing (`activeTab ± 1`). Only the active tab and its immediate neighbors are mounted in the view hierarchy. Distant tabs are unmounted; their state remains safely preserved in persistent Jotai atoms.

### 5. Header Pan Gesture Coordination (Q5)

- **Option A (Chosen):** Continuous 1:1 drag gesture on the tab bar. Moving the finger horizontally drives `scrollPosition` in real-time. Releasing projects momentum and commands `PagerView.setPage()`.

### 6. UX Affordance in Body (Q6)

- **Option A (Chosen):** Making the top header fully interactive eliminates the primary friction point. A subtle initial entry nudge on first launch provides a visual hint of lateral mobility.

### 7. Sensory Haptics (Q7)

- **Option A (Chosen):** Micro-haptic tick (`Segment_Tick`) when crossing tab integer boundaries during continuous dragging, followed by a crisp settling feedback (`ImpactFeedbackStyle.Light`).

### 8. Edge Resistance (Q8)

- **Option A (Chosen):** Rubber-banding / elastic resistance (~0.3 damping ratio) when dragging past the boundaries (Index 0 and Index N-1), springing back cleanly upon release.

---

## Consequences

### Positive

- Solves the tab-switching loop and Fabric `dispatchCommand` errors permanently.
- Eliminates 100% of Yoga layout recalculations during swipes, securing 120fps motion.
- Restores intuitive UX: users dragging the header titles immediately see the UI follow their finger.
- Cuts idle memory and JS execution by ~60% through lazy tab windowing.
- Delivers an Apple-grade, signature tactile feel with fluid velocity stretch and boundary haptics.

### Negative / Trade-offs

- Slight increase in code complexity inside `use-form-pager.tsx` to handle the bidirectional coordination between the header `Gesture.Pan()` and native `PagerView` scroll events.

---

## References

- [Research Document: Menu Navigation Performance, UX Affordances, and Architecture](file:///home/pk/Projects/cron/docs/research/menu-navigation-performance-ux-and-architecture.md)
- Software Mansion React Native Best Practices (`references/animations/SKILL.md`, `references/gestures/SKILL.md`)
- Emil Kowalski Design Engineering Framework (`emil-design-eng/SKILL.md`)
- Apple WWDC: _Designing Fluid Interfaces_
