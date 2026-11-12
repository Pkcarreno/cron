# ADR 0016: Timer Gesture Affordances and Progressive Learning Lifecycle

- **Status**: Accepted
- **Date**: November 2026
- **Context**: Cron (Expo SDK 58, React Native 0.88, New Architecture, Reanimated 4.7, Gesture Handler 3.3, Jotai 2.19, MMKV). Full-screen buttonless chronometer UX.

---

## 1. Context & Problem Statement

Cron deliberately omits traditional on-screen control buttons on the timer face to maximize screen real estate, preserve battery life on OLED displays, and maintain high legibility across athletic environments (gyms, tracks). In-session control relies entirely on full-screen gestures:

- **Long Press (600ms)**: Pause active timer.
- **Double Tap**: Record lap/round in checkpoint-capable modes (`STOP_WATCH`, `AMRAP`).

### The Challenge

1. **Low Discoverability**: Athletes instinctively tap once expecting play/pause (mental model from music players). Single taps previously resulted in dead silence, making the application feel unresponsive or frozen.
2. **Rejection of Modals**: Traditional onboarding dialogs, intrusive walkthroughs, or coachmark overlays interrupt athletic flow, cause immediate dismissal without reading, and pollute visual purity.
3. **Double-Tap Collision & Actuator Saturation (PR #95)**: Firing haptics on touch-down (`onBegin`) saturated the device haptic motor and conflicted with the 300ms window needed to disambiguate double-taps.
4. **Learning State Coupling**: If pause guidance and lap guidance share a single generic counter, practicing in a mode without laps (e.g., _For Time_) prematurely suppresses lap guidance when the athlete later enters _Stopwatch_ or _AMRAP_.
5. **Session Dilution**: If repetition count increments on every single lap, an athlete logging 10 rounds in one workout would permanently lose guidance before building genuine muscle memory across multiple days.

---

## 2. Decision & Architecture

We adopt a **Three-Tier Progressive Affordance Architecture** with **Distinct Session Learning Lifecycle**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TIMER FACE GESTURE ARCHITECTURE                      │
│                                                                        │
│   [Tier 2: Top Edge Real-Time Hold Progress Bar (0% -> 100%)]          │
│                                                                        │
│   [Tier 3: Reactive Recovery Pill: "Hold to pause | Double-tap..."]    │
│            (Slides down on unassigned single tap for 1.2s)             │
│                                                                        │
│                               04 : 12                                  │
│                                                                        │
│   [Tier 1: Ambient Monospace Ghost Guide (fades after 3.2s)]           │
│            "HOLD TO PAUSE | DOUBLE-TAP FOR LAP"                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Three-Tier Progressive Affordance Hierarchy

1. **Tier 1 — Ambient Monospace Ghost Guide ([`TimerAmbientHint`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/screens/timer/components/timer-ambient-hint.tsx))**:
   - Rendered at the bottom safe area inset during the first 3.2 seconds of workout entry (including during the preparation countdown phase).
   - Low-contrast neutral typography (`Geist Mono`, 11px, `colors.neutral[500]`, opacity `0.8 -> 0`).
   - Uses pipe separator (`|`) and mode-specific vocabulary matching Cron's glossary:
     - `AMRAP`: `"HOLD TO PAUSE | DOUBLE-TAP FOR ROUND"`
     - `STOP_WATCH`: `"HOLD TO PAUSE | DOUBLE-TAP FOR LAP"`
     - Non-checkpoint modes: `"HOLD ANYWHERE TO PAUSE"`
   - Zero layout shift: positioned absolutely over the gesture layer without altering SVG digit boundaries (ADR 0008).

2. **Tier 2 — Real-Time Hold Tension ([`PressableArea`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/components/pressable-area.tsx))**:
   - Touch-down triggers continuous visual progression (`0%` to `100%` width over 600ms) along the top bezel.
   - **Decoupled Container**: The progress bar is placed outside the scaled children container (`scale: 0.98`), preventing visual clipping or vertical translation during touch-down.
   - **Commit-Only Haptics**: Strict zero-vibration policy on `onBegin` to eliminate haptic actuator saturation and prevent gesture collision with double-taps. Heavy impact fires exclusively upon the 600ms commit threshold. Early release smoothly springs progress back to `0%`.

3. **Tier 3 — Reactive Error Recovery ([`TimerTapRecoveryPill`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/screens/timer/components/timer-tap-recovery-pill.tsx))**:
   - Single taps trigger `onUnassignedTap` with an immediate 1500ms debounce guard.
   - Renders a floating pill (`colors.neutral[900]`, border `colors.neutral[800]`) below the notch for 1200ms.
   - Context-aware copy adhering to domain terminology:
     - `AMRAP`: `"Hold to pause | Double-tap for round"`
     - `STOP_WATCH`: `"Hold to pause | Double-tap for lap"`
     - Non-checkpoint modes: `"Hold to pause"`

---

### 2.2. Dual Atom Learning State & Session-Guarded Experience

To ensure guidance retires only when true cross-session proficiency is achieved:

1. **Dual Independent Atoms in MMKV ([`screens/timer/atoms.ts`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/screens/timer/atoms.ts))**:
   - `timerSuccessfulPausesCountAtom` (`"cron_successful_pauses_count"`): tracks pause experience.
   - `timerCheckpointsLoggedCountAtom` (`"cron_checkpoints_logged_count"`): tracks checkpoint experience.
   - Threshold for permanent retirement is **3 completed experiences** per action.

2. **Distinct Session Counting Guards ([`screens/timer/components/timer-root.tsx`](file:///home/pk/.t3/worktrees/cron/t3-1a0ea765-14d91e96428ee0f5/screens/timer/components/timer-root.tsx))**:
   - Monitored via transient session refs: `hasPausedInSessionRef` and `hasLoggedCheckpointInSessionRef`.
   - Logging 20 rounds in a single AMRAP only increments the checkpoint counter by **+1** (1 session of experience).
   - Pausing 5 times in a single workout only increments the pause counter by **+1**.
   - Requires interacting with the gestures across **3 distinct workout sessions** before the ambient guide permanently dissolves.
   - When pause is mastered ($\ge 3$) but laps/rounds are not ($< 3$), the ambient guide dynamically sharpens to: `"DOUBLE-TAP TO RECORD ROUND"` (AMRAP) or `"DOUBLE-TAP TO RECORD LAP"` (Stopwatch).

---

## 3. Consequences & Invariants

- **Zero Intrusive Modals**: First-time users learn the interaction mechanics entirely in-flow without modals, dialogues, or dismiss buttons.
- **Zero Layout Shifts**: Adheres to ADR 0008; no dynamic text or pill insertion alters the coordinate bounding box of the vector clock digits.
- **Cross-Mode Integrity**: High familiarity with _For Time_ workouts does not conceal necessary gesture guidance upon first using _Stopwatch_ or _AMRAP_.
- **Tactile Purity**: Zero actuator collisions ensure double-tap recognition remains deterministic under high athletic finger speed.
