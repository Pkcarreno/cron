# AGENTS.md

Operating reference for autonomous AI agents working in `cron`.

---

## Operating Posture

- **Verification Loop**: Run tests (`pnpm test`), typecheck (`pnpm typecheck`), and lint (`pnpm lint`) before reporting completion. Keep feedback loops tight.
- **Test-Driven Changes**: Write or adapt unit tests alongside core logic. All tests must be deterministic.
- **Single Source of Truth**: The codebase and environment are the primary source of truth. Consult `GLOSSARY.md` for domain terminology and `docs/adr/` for architectural records.

---

## Commands

- `pnpm test`: Execute Jest unit test suites.
- `pnpm typecheck`: Run TypeScript compiler type checking (`tsc --noEmit`).
- `pnpm lint`: Run Ultracite linter check (`oxlint`).
- `pnpm lint:fix`: Automatically fix linting and formatting issues (`oxlint` + `oxfmt`).
- `pnpm start`: Start the Expo Metro bundler.
- `pnpm perf:doctor`: Verify performance profiling environment (ADB, device, refresh rate, Maestro, Flashlight).
- `pnpm perf:build`: Compile preview APK tagged by git commit into `benchmark/outputs/cron-<commit>.apk`.
- `pnpm perf:measure`: Execute Flashlight benchmark with device stabilization into `benchmark/results/<scenario>-<commit>.json`.
- `pnpm perf:compare`: Diff baseline vs candidate benchmark JSONs and output delta table with budget gate warnings.

---

## Conventions

### Code & Documentation

- Write all code, identifiers, comments, documentation, and git commits in English.
- Apply the `semantic-code-naming` skill for identifier naming and grammar (A/HC/LC, positive boolean prefixes).
- Apply the `asd-ste100` skill for technical prose (TSDoc, error messages, documentation).
- Document architectural rationale and invariants (_why_); omit mechanics obvious from the code (_what_).
- Provide TSDoc only for exported APIs, module contracts, and complex logic; omit for self-evident code.

### Structure & Modules

- Import directly from leaf module files; avoid barrel re-export files (`index.ts`), except Expo Router route files (`app/**/index.tsx`) and screen root entries.
- Colocate unit tests next to source files as `<filename>.test.ts` (e.g. `tick-engine.ts` → `tick-engine.test.ts`).
- Prefer TypeScript `interface` for public module contracts and component props.
- Consult the `typescript-advanced-types` skill when designing complex generics, mapped types, or utility types.

### UI, Gestures & Motion

- Consult `apple-design` and `emil-design-eng` for interaction physics, UX philosophy, and direct manipulation principles.
- Use `animate-expo` as the sole authority for mobile animation and gesture implementation (Reanimated 4 worklets, Gesture Handler, `expo-haptics`). Do not use web DOM APIs.
- Apply `react-native-best-practices` and `vercel-react-native-skills` for list performance, thread isolation, and native rendering optimizations.
- Apply `expo-router` for navigation, screen stacks, and layout conventions.
- Apply `jotai` for atomic state management and MMKV persistence in `stores/`.

### Performance Verification

- When modifying gestures, animation worklets, sheet interactions, or timer loops:
  1. Confirm ADB and tool prerequisites via `pnpm perf:doctor`.
  2. Compile baseline and candidate preview binaries via `pnpm perf:build`.
  3. Execute automated Maestro flows with hardware stabilization via `pnpm perf:measure`.
  4. Compare performance metrics via `pnpm perf:compare <baseline.json> <candidate.json>`.
  5. Adhere to soft budget thresholds:
     - Frame Budget: $\le 8.33\text{ ms}$ (120 Hz) or $\le 16.67\text{ ms}$ (60 Hz).
     - Jank Rate: $\le 2.0\%$ dropped frames.
     - JS Thread CPU: $\le 15.0\%$ during active gestures.
  6. Maintain `collapsable={false}` on parent containers designated with `testID` for Maestro interaction to prevent Fabric C++ view flattening. Consult ADR-0005.

---

## Architecture Overview

1. **`helpers/timer/`**: Decoupled timer domain.
   - `TickEngine`: High-precision timestamp delta accumulator independent of React.
   - `TimerStrategy`: Pure state calculation interface (`DownStrategy`, `UpStrategy`, `RoundStrategy`, `IntervalStrategy`, `StopwatchStrategy`).
   - `TimerController`: Stateful lifecycle coordinator and event dispatcher (`TimerEventType`).
2. **`screens/`**: Feature screen components (`screens/menu`, `screens/timer`, `screens/settings`).
3. **`app/`**: File-based Expo Router navigation routes.
4. **`stores/`**: Jotai atom definitions and MMKV persistent storage.

---

## Agent skills

### Issue tracker

GitHub Issues via gh CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout with root glossary and ADRs. See `docs/agents/domain.md`.
