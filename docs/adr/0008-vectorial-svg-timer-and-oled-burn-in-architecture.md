# ADR 0008: Vectorial SVG Display, Adaptive Tick Engine, and Active OLED Burn-in Protection

- **Status**: Accepted
- **Date**: October 2026
- **Context**: React Native 0.88.0, Expo SDK 58 (`58.0.16`), New Architecture (Fabric & TurboModules), React 19 (`19.3.0`), `react-native-svg` (`15.16.0`), `react-native-reanimated` (`4.7.1`), `react-native-gesture-handler` (`3.3.0`), Jotai (`2.19.1`), MMKV (`4.3.2`)

## Context

Athletes utilizing `cron` for high-intensity interval workouts (HIIT, AMRAP, EMOM, For Time) frequently train in sessions lasting 30 to 60+ minutes with the phone positioned several meters away on gym floors or stands. The timer screen operates under strict requirements: maximal numeral legibility from distance, fixed portrait orientation, continuous screen-on state (`useKeepAwake`), and immediate spatial recognition (minutes on the upper row, seconds on the lower row).

The previous timer screen implementation presented three fundamental architectural bottlenecks:

1. **Fragile and Truncated Layout ("Flaky")**:
   - Font sizes were statically calculated via `Dimensions.get("window")` at module load time, failing to adapt to dynamic window insets.
   - Using `adjustsFontSizeToFit` combined with an identical rigid `lineHeight` caused descender/ascender clipping, layout reflows, and cross-platform text layout inconsistencies between Android (FontRenderer) and iOS (CoreText).
   - In preparation mode (3-2-1), minutes were hidden via `opacity: 0` inside an uneven flex layout, preventing true slot reservation and creating subtle layout jumps when the active workout started.
2. **Excessive JavaScript Thread Overhead & Thermal Pressure**:
   - `TickEngine` executed an unconditional `requestAnimationFrame` loop on the JavaScript thread at 60 Hz or 120 Hz (ProMotion), calculating timestamps, deltas, and lookaheads continuously even though the visible UI only changes once per second (1 Hz).
   - The root timer component and ambient wall clock triggered cascading re-renders across the entire component tree on every tick.
3. **OLED Burn-in Vulnerability**:
   - During extended workouts with `useKeepAwake`, static chrome (header, mode labels, separators, and context tags) displayed at 100% white luminance (`#FFFFFF`) in static physical pixel coordinates, accelerating organic diode wear and risking permanent screen burn-in.

## Decision

We restructure the timer screen by adopting a **Compound Component** architecture powered by **GPU-accelerated SVG ViewBox rendering**, an **adaptive dual-frequency TickEngine**, **granular Jotai state isolation**, and **active OLED burn-in protection**:

### 1. Vectorial SVG Display Architecture (`react-native-svg`)

- We replace native `Text` font measurement with three isolated SVG components utilizing normalized vector viewports:
  - `<Timer.ContextBannerSvg>`: Dedicated horizontal SVG (`viewBox="0 0 1000 260"`) rendering phase tags (`WORK`, `REST`, `RND`) and counters without line-height truncation.
  - `<Timer.MinutesSvg>`: Normalized vector container (`viewBox="0 0 260 190"`) in a `flex: 1` slot. During preparation (`!flags.showsMinuteDigits`), it renders with `opacity: 0`, strictly preserving the layout slot and preventing layout reflows upon workout start.
  - `<Timer.SecondsSvg>`: Normalized vector container (`viewBox="0 0 260 190"`) in a twin `flex: 1` slot anchored to the bottom half.
- Numerals use `Geist Mono` with `fontVariant={["tabular-nums"]}` inside `<Text>` SVG elements for monospaced glyph metrics.

### 2. Compound Components and State Granularity (Jotai)

- The monolithic timer screen is decomposed into composable compound components:
  - `<Timer.Root>`: Session provider and lifecycle controller binding.
  - `<Timer.OledBurnInProtector>`: Reanimated orbital shifting layer.
  - `<Timer.Header>`: Top status bar chrome anchored across notch/Dynamic Island shoulders (`height: insets.top`).
  - `<Timer.LocalClock>`: Isolated leaf component subscribed to minute boundary updates, preventing local clock re-renders from invalidating the workout timer tree.
  - `<Timer.Display>`: Twin flex container for minutes and seconds SVGs.
  - `<Timer.GestureOverlay>`: Touch interaction layer governed by `react-native-gesture-handler`.
- Independent derived atoms (`timerDisplayTimeMsAtom`, `timerMinutesStrAtom`, `timerSecondsStrAtom`) isolate updates:
  - `<Timer.SecondsSvg>` re-renders at 1 Hz.
  - `<Timer.MinutesSvg>` re-renders at 1/60 Hz (once per minute).
  - `<Timer.ContextBannerSvg>` re-renders only on phase or round transitions.

### 3. Adaptive Dual-Mode Tick Engine & Precision Settings

- `TickEngine` supports two operating cadences:
  - **Standard Mode (Default / Battery Efficient)**: Employs an interval timer running at 20 Hz (50 ms) synchronized to `performance.now()` monotonic timestamps. This reduces JavaScript thread cycles by >80% while comfortably retaining sample accuracy for the 500 ms `TRANSITION_APPROACHING` audio lookahead window and countdown beeps.
  - **High Precision Mode**: Continuous 60/120 Hz loop driven by `requestAnimationFrame` for millisecond-level tick sampling.
- Backed by persistent MMKV storage in `stores/settings.ts` via `isHighPrecisionTimerEnabledAtom` (default `false`) and a user-facing toggle in the Settings screen.

### 4. Active OLED Burn-in Mitigation

- `<Timer.OledBurnInProtector>` wraps the interface with Reanimated:
  - Applies subtle cyclic micro-translations along an 8-step orbital path (between -2 px and +2 px in X and Y) every 90 seconds using a critically damped spring (`dampingRatio: 1, duration: 800`).
  - The 1–2 pixel shift is imperceptible to an athlete standing meters away, but periodically shifts electrical load across adjacent OLED subpixels.
- **Sub-Peak Luminance Capping**:
  - All static elements (mode labels, battery indicators, separators, and ambient clock) are clamped to `colors.neutral[400]` (`#A1A1AA`).
  - Canvas background is locked to pure `#000000`, keeping unused OLED pixels completely unpowered.

### 5. Physical Touch Mechanics in PressableArea

- `PressableArea` integrates Reanimated spring physics and multi-stage haptic feedback:
  - **Touch-Down**: Immediate `withSpring(0.98, { dampingRatio: 1, duration: 150 })` accompanied by a light selection haptic pulse (`selectionAsync`).
  - **600 ms Long-Press Commit**: Dispatches heavy impact haptic feedback (`Heavy`), pauses the session, and restores scale to `1.0`.
  - **Early Release / Cancellation**: Rebounding spring smoothly returns scale to `1.0` without pausing.

## Consequences

- **Positive**:
  - **Zero Text Clipping**: Vectorial SVG viewports scale numerals cleanly across all screen sizes without ascender/descender truncations or layout reflows.
  - **Minimal CPU Overhead**: 20 Hz tick sampling drops JavaScript thread pressure by >80% during 60-minute workouts, mitigating thermal throttling.
  - **OLED Longevity**: Periodic orbital pixel-shifting and luminance capping protect hardware displays during extended screen-on usage.
  - **Render Isolation**: Minutes render at 1/60 Hz and the local clock updates at minute boundaries without triggering full-screen re-renders.
  - **Tactile Directness**: Immediate physical scale on touch-down eliminates perceived latency when pausing.
- **Negative**:
  - `react-native-svg` requires explicit font postscript family matching on Android.
  - Requires maintaining both SVG viewbox aspect ratios and flex container structures.
