# Research & UX Evaluation: Intuitive Gesture Controls on Timer Face

**Date:** November 2026  
**Status:** Complete / Proposal for Architecture & UX  
**Context:** Cron (Expo SDK 58 / React Native 0.88 / New Architecture / Reanimated 4.7 / Gesture Handler 3.3 / Jotai 2.19)  
**Scope:** Solving gesture discoverability (Hold to Pause, Double-Tap for Lap) on the buttonless timer screen without intrusive modal dialogs, evaluating Apple Human Interface Guidelines and Emil Kowalski’s Design Engineering principles.

---

## 1. Executive Summary & Problem Diagnosis

Cron's timer screen is conceived as a pure digital chronometer: an edge-to-edge, OLED true-black (`#000000`) canvas dominated by high-legibility SVG typography, designed to be read from across a gym or track. To preserve this visual purity, chrome buttons (e.g., standard "Pause", "Lap", "Stop" buttons) were deliberately omitted in favor of full-screen gestures handled by [`TimerGestureOverlay`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/screens/timer/components/timer-gesture-overlay.tsx) and [`PressableArea`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/components/pressable-area.tsx).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CURRENT TIMER SCREEN                            │
│                                                                        │
│   STW                                                        17:15     │
│   L02 | +0.4s                                                          │
│                                                                        │
│                                                                        │
│                             04 : 12                                    │
│                                                                        │
│                                                                        │
│   [Entire screen is a touch surface: Long-Press 600ms = Pause]         │
│   [Double-Tap = Record Lap/Round]                                      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 The Discoverability Gap

While navigation across the menu and modal sheets is standard and intuitive, **in-session control gestures suffer from low discoverability on first encounter**:

1. **Mental Model Mismatch (Single Tap vs. Long Press)**:
   - In most media players, stopwatches, and digital timers, the primary interaction is a **single tap** (Tap to Play/Pause).
   - In an intense athletic workout, however, a single tap is prone to accidental triggers (sweaty fingers, brushing against clothing, dropping onto a mat). Cron deliberately chose **Long Press (600ms)** to prevent false triggers.
   - When a first-time athlete attempts to pause, their instinctive action is a **single tap**. Currently, single tap has no registered handler (`onPress` is `undefined`), meaning the app does **literally nothing**. To the athlete, the screen feels frozen or unresponsive.

2. **Inadequate Feedback During Gesture Progression**:
   - In [`components/pressable-area.tsx`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/components/pressable-area.tsx#L85-L90), touching down scales the container to `0.98` with `withSpring(0.98)`.
   - A 2% scale is so subtle on a black screen with centered digits that users do not perceive it as a "charge-up". There is no visual or haptic sense of building tension toward an action.
   - If the user releases at 400ms, the screen springs back to `1.0` without any indication of why nothing happened.

3. **The Rejection of Modal/Dialog Onboarding**:
   - Traditional apps introduce gestures via intrusive coach-marks, walkthrough tooltips ("Tap and hold anywhere to pause!"), or alert dialogs.
   - **Why this fails in Cron**: Athletes open a timer to train immediately. A modal dialog creates friction, breaks flow, insults the user's intelligence, and is dismissed without reading.
   - **The UX Goal**: The interface itself must teach the user through **natural, ambient affordances and progressive feedback**, allowing muscle memory to form organically.

---

## 2. Theoretical Framework: Apple HIG vs. Emil Kowalski

To design a solution that feels both invisible and intuitive, we evaluate the interaction principles of **Apple Human Interface Guidelines (Fluid Interfaces)** and **Emil Kowalski's Design Engineering philosophy**.

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                 DESIGN PILLARS                                        │
│                                                                                       │
│  APPLE HIG (Fluid Interfaces)             EMIL KOWALSKI (Design Engineering)          │
│  • Direct Manipulation & 1:1 Response      • Hold-to-Act / Deliberate Interaction     │
│  • Continuous Feedback *during* gesture   • Asymmetric Enter/Exit Timing              │
│  • Wayfinding without visual clutter      • Reactive Error Nudges over Dead States    │
│  • Reversibility & Zero Latency           • Invisible Details that Compound           │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Apple Design Principles (WWDC talks & HIG)

1. **Feedback Must Be Continuous During the Interaction, Not Just at the End**:

   > _"Feedback lives on the press, and it's instant... Update the UI 1:1 with the pointer the whole way through — never animate only when the gesture completes."_
   - Waiting until the full 600ms completes before firing a haptic pulse or changing the screen state violates the continuity rule. The user needs continuous micro-milestones during those 600ms to understand that "holding produces an effect".

2. **Causality & Harmony**:

   > _"The visual, the sound, and the haptic must fire on the same frame. Latency between them destroys the illusion."_
   - Visual feedback (progress indicator) and tactile feedback (ticking haptics) must synchronize seamlessly during the press gesture.

3. **Wayfinding & Agency**:

   > _"Every screen should answer: Where am I? What can I do here? How do I get out?"_
   - A screen without any signifier leaves the user stranded. However, simplicity dictates: _"Strip the unnecessary so the core purpose shines... sometimes adding context simplifies."_ A subtle, non-intrusive hint is vastly superior to total visual silence.

4. **Hint in the Direction of the Gesture**:
   > _"Humans predict a final state from a trajectory. Intermediate motion should telegraph where things are going."_

### 2.2 Emil Kowalski's Design Engineering Philosophy

1. **The Hold-to-Act Pattern (Deliberate Interactions)**:

   > _"Pressing should be slow when it needs to be deliberate, but release should always be snappy. Slow where the user is deciding, fast where the system is responding."_
   - When an action is destructive or mode-shifting (like pausing an active workout), a deliberate hold is physically sound. But the interface must visually exhibit this "deliberation" (e.g., a progress ring, a boundary stroke, or an accelerating scale).

2. **Never Leave an Input Dead (The Reactive Nudge)**:
   - When a user performs an invalid or incomplete action (such as a single tap when a long press was expected), an unresponsive screen creates confusion.
   - An intentional interface provides a **reactive nudge**: an elastic micro-recoil (`scale(0.97) -> spring back`) paired with an instant contextual hint (_"Hold to pause"_), which appears for 1.2s and dismisses itself.

3. **Unseen Details Compound & Fade Away**:
   > _"When a feature functions exactly as someone assumes it should, they proceed without giving it a second thought."_
   - Once muscle memory is acquired, onboarding hints must vanish permanently. The interface should never treat a veteran athlete like a novice.

---

## 3. Comparative Evaluation of Discovery Patterns

We analyzed four distinct patterns to solve gesture discoverability without modal dialogs:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PATTERN OVERVIEW                                                                       │
├───────────────────┬──────────────────────────────────┬─────────────────────────────────┤
│ Pattern           │ Visual Mechanism                 │ Haptic & Timing Behavior        │
├───────────────────┼──────────────────────────────────┼─────────────────────────────────┤
│ A. Ambient Cue    │ Transient label on session start │ Auto-fades after 3s (ease-out)  │
│ B. Hold-Charge    │ Edge-glow / Perimeter progress   │ 600ms linear fill + spring exit │
│ C. Reactive Nudge │ Shake + contextual pill on tap   │ Rigid impact + 1200ms toast     │
│ D. Static Chrome  │ Permanent pause button/badge     │ Static icon (breaks minimalism) │
└───────────────────┴──────────────────────────────────┴─────────────────────────────────┘
```

### Pattern A: Ambient Ephemeral Cue (First-Run Auto-Fade)

- **Concept**: When a timer starts (or during the 3-second preparation countdown), a subtle, low-luminance monospaced indicator appears near the footer or beneath the timer digits:
  ```
  [ HOLD TO PAUSE • DOUBLE-TAP FOR LAP ]
  ```
- **Behavior**: Rendered in `Geist Mono` at 12px with `colors.neutral[500]` (low contrast, non-distracting). After 3.5 seconds of active ticking, it gracefully fades out (`opacity: 1 -> 0` via `withTiming(0, { duration: 400 })`) or dismisses immediately on first touch.
- **Pros**: Zero user friction; does not block workout start; clean integration with the OLED design system.
- **Cons**: If the athlete is not looking at their phone during the first 3 seconds (e.g., getting into position for squats), they might miss it.

### Pattern B: Continuous Hold-to-Pause Charge-Up (Perimeter / Radial Fill)

- **Concept**: When the user presses their finger anywhere on the screen, the interface actively communicates that a hold is occurring:
  - **Visual**: A 2px perimeter border or top/bottom progress line in `colors.neutral[300]` starts filling around the screen edge from 0% to 100% over exactly 600ms. Simultaneously, the timer display scales from `1.0` down to `0.96` with elastic tension.
  - **Haptic**: An initial subtle click on `onBegin`, followed by a heavy impact (`ImpactFeedbackStyle.Heavy`) upon the 600ms completion mark.
  - **Cancelation**: If released at 300ms, the progress snaps back to 0 immediately (`duration: 150ms ease-out`), teaching the user that the action was aborted.
- **Pros**: Satisfies Apple's principle of 1:1 continuous feedback during interaction. Visually communicates "tension and release".
- **Cons**: Does not teach the gesture before the user touches the screen, but makes the hold interaction intensely satisfying and obvious once initiated.

### Pattern C: The Reactive Single-Tap Fallback (Error-Driven Recovery)

- **Concept**: Athletes instinctively tap the screen to pause. Instead of dropping the single tap:
  - When a single tap activates, the timer digits perform a subtle horizontal micro-shake (3px amplitude, 180ms spring damping 1.0) or elastic pulse, and a minimal glass pill slides down from the top edge:
    ```
    ┌───────────────────────────┐
    │   Press & hold to pause   │
    └───────────────────────────┘
    ```
  - The pill remains visible for 1.4s, then exits with `withTiming(0)`.
  - It triggers a warning/light haptic (`ImpactFeedbackStyle.Light`).
- **Pros**: Capitalizes on the user's natural error. It meets them exactly at the point of confusion without requiring any proactive attention.
- **Cons**: Requires handling single-tap disambiguation without delaying the double-tap gesture.

### Pattern D: Permanent Ghost Chrome / Tap Target

- **Concept**: Adding a persistent floating pill or header button ("PAUSE").
- **Pros**: 100% discoverable.
- **Cons**: **Rejected**. Destroys Cron's digital wall timer aesthetic, risks OLED burn-in, creates accidental tap targets during high-intensity workouts, and violates ADR 0008.

---

## 4. The Recommended Solution: The 3-Tier Progressive Experiential Model

Rather than relying on a single trick, the optimal UX combines **Patterns A, B, and C** into a cohesive, self-effacing interaction system that aligns with both Apple and Emil Kowalski:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        3-TIER PROGRESSIVE GESTURE SYSTEM                               │
│                                                                                        │
│   TIER 1: Ambient Prompt (Onboarding)                                                  │
│   • Appears at session start for 3.5s in low-contrast neutral (35% opacity).           │
│   • Permanently retired after 3 completed sessions via persistent Jotai/storage atom.  │
│                                                                                        │
│   TIER 2: Continuous Hold Tension (Affordance during Press)                            │
│   • On pointer down: Screen scales to 0.96, perimeter progress line fills (0-600ms).   │
│   • Immediate light haptic on touch down; heavy impact upon threshold trigger.         │
│   • Spring reset if released early.                                                    │
│                                                                                        │
│   TIER 3: Reactive Recovery (Error Guidance on Single Tap)                             │
│   • When user single-taps, display subtle recoil + floating pill:                      │
│     "Hold anywhere to pause" for 1400ms.                                               │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Detailed Interaction Specifications

#### 1. Tier 1: Ambient Monospace Ghost Guide

- **Location**: Rendered inside [`TimerGestureOverlay`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/screens/timer/components/timer-gesture-overlay.tsx) centered along the bottom safe area inset.
- **Copy**:
  - Both pause and lap unlearned: `"HOLD TO PAUSE | DOUBLE-TAP FOR LAP"`
  - Pause learned, lap unlearned: `"DOUBLE-TAP TO RECORD LAP"`
  - Non-checkpoint modes (For Time, Tabata, EMOM): `"HOLD ANYWHERE TO PAUSE"`
- **Typography & Color**: `fontFamily: 'Geist Mono'`, `fontSize: 11`, `letterSpacing: 1.2`, `color: colors.neutral[500]`.
- **Motion**:
  - Mounts at `opacity: 0`.
  - Animates to `opacity: 0.8` (`duration: 300ms ease-out`).
  - Stays for 3200ms (`AMBIENT_HINT_DURATION_MS`).
  - Fades to `opacity: 0` (`duration: 500ms ease-in-out`).
- **Memory & Session-Guarded Learning**:
  - Evaluated against two distinct atoms in MMKV: `timerSuccessfulPausesCountAtom` and `timerCheckpointsLoggedCountAtom`.
  - Increments are guarded per distinct workout session (`hasPausedInSessionRef`, `hasLoggedCheckpointInSessionRef`).
  - Practicing multiple rounds in a single session only counts as 1 session of experience, requiring 3 distinct workout sessions to permanently retire guidance.

#### 2. Tier 2: Real-Time Hold-to-Pause Tension

- **Component**: Integrated directly into [`components/pressable-area.tsx`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/components/pressable-area.tsx).
- **Decoupled Architecture**:
  - The progress bar is rendered at the root level outside the `<Animated.View>` container that applies `scale: 0.98`.
  - Width animates via percentage (`0%` to `100%`) from `left: 0` (`height: 2.5px`, `backgroundColor: colors.neutral[400]`).
  - This ensures the progress bar never jumps or visually clips down by ~8px during touch-down.
- **Commit-Only Haptics**:
  - Adhering to the learnings from PR #95, touch-down (`onBegin`) produces **zero vibration** to avoid actuator saturation and false double-tap collisions.
  - `onActivate` (at 600ms): triggers heavy impact haptic upon successful pause commitment.
  - `onFinalize` (if released early): resets progress and scale back to defaults via spring.

#### 3. Tier 3: Reactive Guidance Pill

- **Trigger**: On unassigned single tap while running, `PressableArea` invokes `onUnassignedTap`.
- **Debounce**: 1500ms debounce prevents visual churn during accidental touch bursts.
- **Copy**:
  - For checkpoint-capable modes (`hasCheckpointsBehavior`): `"Hold to pause | Double-tap for lap"`
  - For non-checkpoint modes: `"Hold to pause"`
- **Visual Presentation**:
  - Rendered in [`TimerTapRecoveryPill`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/screens/timer/components/timer-tap-recovery-pill.tsx) below top notch.
  - Subdued pill (`backgroundColor: colors.neutral[900]`, `borderColor: colors.neutral[800]`, `Geist Mono` 12px).
  - Smooth spring slide down, visible for 1200ms, then fades out over 300ms.

---

## 5. Architectural & Implementation Plan

### 5.1 Updates to `PressableArea` & Gesture Orchestration

Currently, `singleTap` in [`components/pressable-area.tsx`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/components/pressable-area.tsx#L94-L105) is disabled when `onPress` is undefined:

```tsx
const singleTap = useTapGesture({
  enabled: Boolean(onPress),
  // ...
});
```

To enable the Reactive Fallback without breaking existing callers:

```tsx
const singleTap = useTapGesture({
  enabled: true, // Always listen for taps
  onActivate: () => {
    if (onPress) {
      triggerHaptic({
        mode: ImpactFeedbackStyle.Medium,
        type: triggerType.Impact,
      });
      onPress();
    } else {
      // Trigger reactive hint callback
      onUnassignedTap?.();
    }
  },
  requireToFail: [doubleTap, longPress],
  runOnJS: true,
});
```

### 5.2 Hold Progress Bar (Worklet-Driven)

```tsx
// Inside PressableArea
const holdProgress = useSharedValue(0);

const longPress = useLongPressGesture({
  enabled: Boolean(onLongPress),
  minDuration: LONG_PRESS_DURATION,
  onBegin: () => {
    scale.set(withTiming(0.96, { duration: LONG_PRESS_DURATION }));
    holdProgress.set(withTiming(1, { duration: LONG_PRESS_DURATION }));
  },
  onActivate: () => {
    scale.set(withSpring(1, { dampingRatio: 1, duration: 150 }));
    holdProgress.set(0);
    triggerAndroidHaptic(AndroidHaptics.Long_Press, {
      mode: ImpactFeedbackStyle.Heavy,
      type: triggerType.Impact,
    });
    onLongPress?.();
  },
  onFinalize: () => {
    scale.set(withSpring(1, { dampingRatio: 1, duration: 150 }));
    holdProgress.set(withSpring(0, { dampingRatio: 1, duration: 150 }));
  },
  runOnJS: true,
});
```

### 5.3 Gesture Hint Atom & Storage Schema

In [`screens/timer/atoms.ts`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/screens/timer/atoms.ts):

```typescript
export const timerSessionCountAtom = atomWithStorage<number>(
  "cron_session_count",
  0
);
export const isGestureHintVisibleAtom = atom<boolean>(false);
export const gestureHintTextAtom = atom<string>("");
```

---

## 6. Design Engineering Review (Emil Format)

| Before | After | Why |
| --- | --- | --- |
| Dead silence on single tap | Reactive micro-shake + 1.2s toast "Hold to pause" | Users instinctively tap; silence feels broken. Educate at the point of error. |
| Instant 0.98 scale on press without feedback | Continuous 0-600ms hold progress indicator + scale to 0.96 | Communicates tension and intent; user sees their hold charging the pause action. |
| Zero visible affordance on first session | Ephemeral 3.5s monospace hint auto-fading on session start | Teaches controls during prep phase; disappears before workout rhythm begins. |
| Single haptic only after 600ms | Light tick on touch-down, heavy impact on commit | Confirms finger contact instantly (Apple: latency kills the direct manipulation illusion). |
| Static scale spring back | Damped spring exit (`damping: 1.0, duration: 150ms`) | Physical feel when aborting a hold mid-gesture without jarring transitions. |

---

## 7. Conclusion & Next Steps

1. **Adopt the 3-Tier Model**: Discard modal dialogs entirely. Allow the interface to teach itself through ambient entry hints, continuous hold tension, and reactive error handling.
2. **Implement Hold Progress in `PressableArea`**: Enhance `PressableArea` with a worklet-driven progress bar and calibrated haptic escalation.
3. **Persist Experience Level**: Ensure hints disappear permanently once the user demonstrates proficiency (after 3 successful sessions).
