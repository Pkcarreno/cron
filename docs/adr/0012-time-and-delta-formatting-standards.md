# ADR 0012: Time and Delta Formatting Standards for Tabular and Live Displays

- **Status**: Accepted
- **Date**: November 2026
- **Context**: Resolves decimal overflow in `SummaryFace` checkpoint tables (AMRAP, Stopwatch), unifies live delta presentation in `TimerFace` and atoms, and aligns duration formatting with international sporting chronometer standards.

---

## 1. Problem Statement & Context

In `SummaryFace`, checkpoint split tables rendered for round-based modes (`AMRAP`, `INTERVAL`, `STOP_WATCH`) feature a 4-column layout (`Round/Lap`, `Time`, `Duration`, `Delta`). Under high-precision execution:

1. **Floating-point Jitter**: [`TickEngine`](file:///home/pk/.t3/worktrees/cron/t3-77ccc2d1/helpers/timer/tick-engine.ts) employs `performance.now()`, which yields microsecond-precision fractional floats (e.g. `412.39999997615814` ms).
2. **Sub-second Overflow**: The legacy [`formatDuration`](file:///home/pk/.t3/worktrees/cron/t3-77ccc2d1/helpers/timer/utils/formatter.ts) implementation formatted sub-second values (`absMs < 1000`) directly as `${absMs}ms`. This caused deltas like `+412.39999997615814ms` or `-0.20000004768371582ms` to reach up to 24 characters, severely overflowing narrow table cells on mobile screens and breaking into 3–4 wrapped lines.
3. **Discontinuous Units and Jittery Widths**: Deltas transitioned abruptly between `ms` (`+500ms`), truncated seconds (`+4.3s`), and clock notations (`+1:05.50`). Furthermore, trimming trailing zeros (`Number(toFixed(3))`) caused digits to jump horizontally on monospace columns between consecutive rows.

---

## 2. Industry Chronometer Benchmark Analysis

We evaluated international standards across competitive timing domains:

1. **Human Athletic & Aquatic Timing (World Athletics Rule 165, World Aquatics / FINA, Olympic OMEGA/Seiko)**:
   - **Standard**: Centiseconds (**2 decimal places**: `0.01s` / `±SS.cc` / `±MM:SS.cc`).
   - **Rationale**: Human tactile and visual reaction time averages 150–250 ms. Displaying beyond 2 decimal places reflects interaction jitter (touch latency of 5–15 ms) rather than actionable human performance.
   - **Consumer Benchmarks**: Apple Stopwatch (iOS), Garmin Connect, Strava, and Polar standardise lap splits strictly to centiseconds (`.xx`).
2. **Motorsport & Telemetry (FIA, Formula 1, MotoGP)**:
   - **Standard**: Milliseconds (**3 decimal places**: `0.001s` / `±S.mmm`).
   - **Rationale**: Useful only when vehicles travel at >300 km/h where 1 ms represents ~8.3 cm of track.
3. **Four Decimal Places (`0.0001s`)**:
   - Absent in consumer or professional sporting interfaces; confined to particle physics, CPU benchmarking, and network synchronization (PTP/NTP).

---

## 3. Decision & Architecture

We adopt the **Centisecond Standard (2 fixed decimal places)** with uniform tabular alignment across the entire presentation layer:

### 3.1. Dedicated `formatDelta(deltaMs: number): string`

- **Homogeneous Units**: Deltas sub-minute are always rendered in seconds (`±S.ss s`, e.g. `+0.41s`, `-0.20s`), eliminating the raw `ms` suffix from delta columns.
- **Strict 2-Decimal Padding**: Uses `.toFixed(2)` with fixed trailing zeros (`+4.30s` instead of `+4.3s`) for vertical visual stability in monospace fonts.
- **Zero Delta Baseline**: Any delta whose absolute value rounds to zero (`Math.abs(deltaMs) < 5` ms) is rendered as canonical `+0.00s` with neutral text coloring, serving as a stable reference.
- **Scale Hierarchy**:
  - `< 60s`: `±S.ss s` (e.g. `+0.41s`, `+4.30s`, `+15.00s`)
  - `≥ 60s`: `±M:SS.ss` (e.g. `+1:05.50`, `+5:30.34`, without trailing `s`)
  - `≥ 1h`: `±H:MM:SS.ss` (e.g. `+1:05:30.34`)

### 3.2. Configurable `formatDuration(ms, options)`

- Supports `FormatDurationOptions` (`fixedDecimals?: boolean`, `showSign?: boolean`).
- `SummaryFace` checkpoint columns (`Time` and `Duration`) use `fixedDecimals: true` to align to centiseconds (`45.25s`, `2:00.00`).
- Configuration surfaces (such as preparation time in `Settings`) retain clean integer rendering (`5s`, `10s`) without forced decimal noise.

### 3.3. Live Delta Alignment

- [`screens/timer/atoms.ts`](file:///home/pk/.t3/worktrees/cron/t3-77ccc2d1/screens/timer/atoms.ts) and [`TimerFace`](file:///home/pk/.t3/worktrees/cron/t3-77ccc2d1/screens/timer/components/timer-face.tsx) use `formatDelta` for the quick-access status pill (`L03 +15.00s`), maintaining visual parity between in-flight sessions and post-workout summaries.

---

## 4. Consequences

- **Positive**:
  - Checkpoint table columns in `SummaryFace` strictly fit single lines on all mobile form factors.
  - Monospace tabular data aligns vertically without horizontal jumping between laps.
  - Zero performance overhead: rounding and string formatting occur only upon lap logging and summary presentation.
- **Negative**:
  - Historical snapshots or tests asserting raw `ms` outputs (`+500ms` or `+15s`) must be migrated to centisecond notation (`+0.50s`, `+15.00s`).
