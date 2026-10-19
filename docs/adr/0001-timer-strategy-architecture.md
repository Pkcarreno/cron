# ADR 0001: Decoupled Timer Architecture (TickEngine + Strategy + Controller)

## Context

A HIIT timer application requires sub-second precision, responsive UI updates, audio cue dispatching, and support for diverse workout modes (AMRAP, EMOM, Intervals, For Time, Stopwatch). Coupling timer progression directly to React component state or `useEffect` intervals causes timer drift, frame drops, and difficult testing.

## Decision

We decouple timer mechanics into three distinct tiers:

1. **`TickEngine`**: Pure delta accumulator calculating monotonic timestamp progress. Independent of React and UI lifecycles.
2. **`TimerStrategy`**: Pure calculation functions implementing `calculateState(event: TickEvent): TimerState`. Each timer mode is an isolated strategy class (`DownStrategy`, `UpStrategy`, `RoundStrategy`, `IntervalStrategy`, `StopwatchStrategy`).
3. **`TimerController`**: Stateful coordinator binding the engine and the active strategy. Emits strongly-typed lifecycle events (`TimerEventType`) to which UI components and audio services subscribe.

## Consequences

- **Positive**:
  - Deterministic unit testing without UI or device simulators (`helpers/timer/*.test.ts`).
  - Zero state pollution: React components merely observe the controller via hooks (`use-timer.tsx`).
  - New timer modes require only a new strategy implementation without touching the controller or tick engine.
- **Negative**:
  - Requires serialization and factory patterns (`config-serializer.ts`, `factory.ts`) when passing parameters across navigation screens.
