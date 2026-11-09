# Research & UX Evaluation: Notification Permission Notice in Timer Face

**Date:** November 2026  
**Status:** Complete / Proposal for Review  
**Context:** Cron (Expo SDK 58 / React Native 0.88 / New Architecture / Hermes / Jotai 2.19 / `@lodev09/react-native-true-sheet`)  
**Scope:** Re-evaluating the notification permission auto-pause warning (`PermissionAutoPauseBanner`) on the timer screen and paused session face to align with Cron's minimalist, high-legibility athletic timer design philosophy.

---

## 1. Executive Summary & Problem Diagnosis

When an athlete backgrounds Cron during an active workout without notification permissions granted (`POST_NOTIFICATIONS` on Android 13+ or notification authorizations on iOS), the Tier 4 defensive guard in `TimerController` auto-pauses the session to prevent unmonitored time loss. Upon returning to the application, Cron presents `PermissionAutoPauseBanner`.

Currently, this component is perceived as **aesthetically misaligned with the app**. A detailed audit reveals that it behaves and looks like a generic web SaaS banner rather than a precision digital athletic chronometer.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CURRENT IMPLEMENTATION                          │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ [!] Background Tracking Paused                             [X] │   │
│   │ Session paused because notifications are disabled. Enable      │   │
│   │ notifications in Settings to allow background workout tracking.│   │
│   │                                      [Enable Notifications]    │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│   • Rounded rect (radius 12), border #262626, dark card (#171717)      │
│   • Verbose prose (12px sans-serif paragraph)                          │
│   • Desktop-style "X" dismiss button + grey secondary action button    │
│   • Injected into screen layout: pushes SVG timer digits down          │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1. Root Causes of the Aesthetic & Functional Disconnect

1. **Visual Vocabulary Clash (SaaS Alert vs. Wall Timer Chronometer)**:
   - **Cron's Visual Ethos**: High-contrast digital wall timer, OLED true-black (`#000000`), Geist Mono typography, tabular numerics, sub-peak luminance (`#a3a3a3`), and restrained functional color accents (e.g., `#008153` emerald for WORK, `#E7801F` amber for REST/PREP).
   - **The Current Banner**: A rounded rectangular floating card with `#262626` borders, an orange icon, 12px descriptive body text, and standard desktop-style UI buttons. It looks like an administrative dashboard notification dropped into a gym wall clock.

2. **Violation of the Reflow-Free Spatial Layout (ADR 0008)**:
   - In [`screens/timer/components/timer-root.tsx`](file:///home/pk/.t3/worktrees/cron/t3-6eaa4577/screens/timer/components/timer-root.tsx#L343-L353), `{bannerNode}` is rendered above the timer contents inside `styles.container` (`flex: 1`).
   - Adding a 90–120px variable-height card inside the vertical flex container compresses the SVG timer viewport (`viewBox="0 0 400 200"`), squishing or displacing the massive minutes and seconds digits and breaking the 50%/50% flex split.

3. **Inappropriate Distance Ergonomics for Gym/HIIT Contexts**:
   - During high-intensity workouts (CrossFit, Tabata, EMOM), the phone is placed 2 to 4 meters away on the floor or against a rig, or viewed while breathing heavily with sweaty hands.
   - A multi-line 12px explanation with a tiny 22px "X" hit target is impossible to read or interact with reliably under physical exertion.

4. **Breakage of the "Strict Two-Interaction Rule"**:
   - Cron's timer screen is architected around two unambiguous gestures: **long press** (pause / end) and **double tap** (checkpoint / round).
   - The banner introduces multiple small interactive touch targets (an "X" dismiss button, an "Enable Notifications" button) directly adjacent to the gesture zone, risking accidental touches and interaction failures.

5. **Incomplete Guidance (Missing Audio-Only Context)**:
   - The banner only suggests opening OS Settings. However, Cron already provides a dedicated in-app fallback in [`screens/settings/index.tsx`](file:///home/pk/.t3/worktrees/cron/t3-6eaa4577/screens/settings/index.tsx#L55-L57): **"Allow background audio-only session (without notifications)"**.
   - Athletes who intentionally disable notifications for privacy or focus are given no path to enable audio-only background tracking directly from the pause prompt.

---

## 2. Design System & Domain Context

Cron's identity is defined by three core principles documented in `README.md`, `GLOSSARY.md`, and architectural decision records:

| Pillar | Implementation Standard in `cron` | Violation by Current Banner |
| :-- | :-- | :-- |
| **Legibility from Distance** | Massive vector SVG digits, minimal clutter, uppercase mono tags. | 12px prose text, small icons, multi-line paragraph. |
| **Reflow-Free Spatial Viewport** | 50% flex split for minutes, 50% for seconds; layout slots never shift. | Pushes timer content down, causing visual jitter and scaling distortion. |
| **True Black Instrument Aesthetic** | `#000000` background, `#a3a3a3` chrome, zero decorative card borders. | Bordered card box (`neutral[900]` / `neutral[800]`) with web-like drop appearance. |
| **Tactile Simplicity** | Big hit surfaces, spring-damped sheets, minimal modal interruptions. | Tiny "X" button, small secondary button. |

---

## 3. Evaluated Improvement Proposals

To resolve the aesthetic and ergonomic disconnect while preserving the critical defensive protection (ensuring athletes are not left wondering why their workout paused), we evaluated four architectural directions:

---

### Option A: Ambient Telemetry Badge in `QuickAccess` (The "Digital Instrument" Approach)

```
┌────────────────────────────────────────────────────────────────────────┐
│ INT                                                           21:58    │
│ [BAT LOW] | [NO NOTIF: BG PAUSED] | RND 03                             │
│                                                                        │
│                               0 4                                      │
│                               2 0                                      │
└────────────────────────────────────────────────────────────────────────┘
```

- **Concept**: Treat missing notification permission not as a web alert, but as an **instrument status code** integrated into the existing `TimerQuickAccess` header row (alongside `[BAT LOW]`, `01H`, `L01`).
- **How it works**:
  - In `TimerQuickAccess`, display `[NO NOTIF: BG PAUSED]` or `[BG DISABLED]` in `Geist Mono` styled with `colors.orange` or `colors.neutral[400]`.
  - The badge is completely passive or can trigger a detailed explanation sheet only if tapped.
  - Zero layout shift: lives in the pre-allocated quick access line above the context banner.
- **Pros**:
  - 100% adherence to Cron's wall-timer DNA.
  - Zero reflow: digits remain perfectly sized and centered.
  - No accidental clicks or intrusive modal cards during movement.
- **Cons**:
  - First-time athletes might not immediately understand _why_ their timer paused if they only see a concise bracketed status tag.

---

### Option B: Dedicated Actionable TrueSheet on Auto-Pause (The "Actionable Paused Sheet" Approach)

```
┌────────────────────────────────────────────────────────────────────────┐
│                              (Dark Dimmer)                             │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ ───                                                                │ │
│ │ BACKGROUND TRACKING PAUSED                                         │ │
│ │ Notifications are disabled. Choose how to continue:                │ │
│ │                                                                    │ │
│ │ [ OPEN SETTINGS (ENABLE NOTIFICATIONS) ]                           │ │
│ │ [ ALLOW AUDIO-ONLY BACKGROUND WORKOUTS ]                           │ │
│ │ [ DISMISS & RESUME TIMER               ]                           │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

- **Concept**: When the auto-pause event fires (`AUTO_PAUSE_PERMISSION_DENIED`), the app transitions to `PAUSED` state. Instead of placing a banner inside the screen hierarchy, present an elegant, high-contrast `@lodev09/react-native-true-sheet` (the native sheet library already powering Cron's settings and pickers).
- **How it works**:
  - The sheet presents full-width, tactile buttons:
    1. **"Enable Notifications"**: opens device settings via `Linking.openSettings()`.
    2. **"Allow Audio-Only Background"**: flips `isBackgroundAudioOnlyAllowedAtom` to `true` instantly without leaving the app.
    3. **"Resume Session"**: closes the sheet and calls `start()`.
  - Keeps the timer face and summary face completely pristine and clean.
- **Pros**:
  - Native fluid physics (`TrueSheet` with smooth spring detents).
  - Gives the athlete the exact solution they actually want (including the existing audio-only toggle!).
  - Large, sweat-friendly button targets (height $\ge 48\text{px}$).
  - Leaves the timer face 100% reflow-free.
- **Cons**:
  - Requires presenting a sheet modal over `SummaryFace`, which temporarily blocks the summary until dismissed or resolved.

---

### Option C: Integrated Brutalist Section in `SummaryFace` (The "Summary Integration" Approach)

```
┌────────────────────────────────────────────────────────────────────────┐
│ session summary                                              [cron]    │
│ INTERVAL                                                               │
│ 21:50 - 21:58                                                          │
│                                                                        │
│ ┌─ NOTICE: BACKGROUND TRACKING ──────────────────────────────────────┐ │
│ │ Notifications are disabled. Auto-pause was triggered.             │ │
│ │ [Open Settings]   [Enable Audio-Only]                              │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ Total Time: 08:00          Active Time: 06:40           Rounds: 4      │
│ ...                                                                    │
│ [Resume session]                                                       │
│ [Back to menu]                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

- **Concept**: Since `AUTO_PAUSE_PERMISSION_DENIED` switches `status` to `PAUSED`, and Cron renders `SummaryFace` whenever paused, redesign the notice as an **integral part of the summary view's typography**, removing the floating card look.
- **How it works**:
  - Styled with the same typographic rules as `RenderData` and `RenderCheckpoints`: true black background, mono headings, thin dividers, tabular layout.
  - Never appears on the active timer face (only on the paused summary screen).
- **Pros**:
  - Seamlessly blends into `SummaryFace`.
  - Removes the banner from the running timer screen entirely.
- **Cons**:
  - If the user resumes the session without addressing the permission, the warning disappears until the next background event.

---

### Option D: Floating Spring-Damped Glass Pill / HUD (Emil Kowalski / Apple Style)

```
┌────────────────────────────────────────────────────────────────────────┐
│ INT                     [ ! Background Paused ]               21:58    │
│                                                                        │
│                               0 4                                      │
│                               2 0                                      │
└────────────────────────────────────────────────────────────────────────┘
```

- **Concept**: An absolutely positioned, floating status pill anchored at the top or bottom of the screen with Reanimated spring physics (`translateY` entering from top `-100%` $\to$ `0`), semi-translucent dark glass (`rgba(20, 20, 20, 0.9)`), no layout push.
- **How it works**:
  - Floating HUD overlay, non-blocking to timer rendering.
  - Tapping opens the settings/actions sheet.
  - Auto-dismisses or swipes away with natural momentum.
- **Pros**:
  - Extremely polished micro-interaction.
  - Absolutely positioned: 0px layout push on timer digits.
- **Cons**:
  - More complex to build and maintain than native TrueSheet or QuickAccess telemetry.
  - Still contains interactive touch targets on the timer surface.

---

## 4. Proposal Comparison Matrix

| Evaluation Dimension | Current Banner | Option A: Ambient Telemetry | Option B: Actionable TrueSheet | Option C: Integrated Summary | Option D: Floating Glass HUD |
| :-- | :-: | :-: | :-: | :-: | :-: |
| **Visual Cohesion with Cron** | ❌ 1/5 | 🟢 5/5 | 🟢 5/5 | 🟡 4/5 | 🟡 4/5 |
| **Zero Layout Shift (Reflow-Free)** | ❌ Fails (pushes digits) | 🟢 Guaranteed | 🟢 Guaranteed | 🟢 Guaranteed | 🟢 Guaranteed |
| **Distance Legibility (Gym Wall)** | ❌ 12px prose | 🟢 Tabular mono tag | 🟡 Modal context | 🟡 On summary | 🟡 Compact |
| **Sweat & Big-Hit Ergonomics** | ❌ Small X & sm button | 🟢 Passive | 🟢 Full-width buttons | 🟡 Standard buttons | ❌ Small pill |
| **Surfaces Audio-Only Alternative** | ❌ No | 🟡 Via sheet | 🟢 Direct 1-tap toggle | 🟢 Direct buttons | 🟡 Via tap |
| **Implementation Simplicity** | Baseline | 🟢 Low (~20 lines) | 🟢 Medium (~60 lines) | 🟢 Low (~40 lines) | 🟡 High (~150 lines) |

---

## 5. Architectural Recommendation: The Hybrid "Instrument + Action Sheet" Model

The optimal design for Cron combines **Option A** (ambient telemetry) and **Option B** (actionable TrueSheet):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               RECOMMENDED HYBRID MODEL                                 │
├────────────────────────────────────────────────────┬───────────────────────────────────┤
│ Active Timer Face (`TimerDisplay`)                 │ Paused / Auto-Paused (`TrueSheet`) │
├────────────────────────────────────────────────────┼───────────────────────────────────┤
│ • Zero layout shift.                               │ • Presents only when auto-paused.  │
│ • Monospaced telemetry badge in `TimerQuickAccess`:│ • Clean native bottom sheet:      │
│   "[NO NOTIF: BG PAUSED]"                          │   1. "Open Settings"              │
│ • Timer digits remain 100% full-screen & centered. │   2. "Allow Audio-Only Mode"      │
│ • Long-press / double-tap gesture integrity intact.│   3. "Resume Workout"             │
└────────────────────────────────────────────────────┴───────────────────────────────────┘
```

### Why this is the ideal solution:

1. **Purity of the Timer Face**: The timer screen remains an unadulterated, high-contrast wall clock. No floating web boxes, no squished digits, no tiny "X" buttons.
2. **Contextual Actionability**: When auto-pause happens, the athlete needs to make a decision before continuing. The `TrueSheet` provides clear, large, touch-friendly actions, including activating the **Audio-Only Mode** directly without navigating away.
3. **Architectural Consistency**: Leverages Cron's existing design system primitives (`TrueSheet`, `colors`, `Button`, `Text`) and preserves the multi-tier notification model documented in ADR 0011.

---

## 6. Next Steps & Proposed Roadmap

1. **User Consultation & Direction Selection**: Confirm whether the user prefers the Hybrid Model (Option A + B) or an alternative approach (e.g. Option C inside `SummaryFace`).
2. **Component Refactoring**:
   - Deprecate/replace `PermissionAutoPauseBanner` with `PermissionAutoPauseSheet` (utilizing `TrueSheet`).
   - Add permission status to `timerQuickAccessInfoAtom` in `screens/timer/atoms.ts`.
3. **Test Suite Verification**:
   - Update `screens/timer/index.test.tsx` and unit tests to assert sheet presentation and action handling instead of the legacy banner element.
