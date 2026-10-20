# ADR 0003: Modernization of Tooling Stack to Ultracite v8 and Oxlint/Oxfmt

## Context

When `cron` was initialized, the project replaced the traditional ESLint + Prettier stack with Oxlint, Oxfmt, and Ultracite. At the time, this experimental stack required several manual defensive overrides in `oxlint.config.ts` (such as suppressing `import/namespace`, global Jest rules, and Vitest collisions) due to upstream parser limitations and the absence of native React Native presets in Ultracite.

With the release of Ultracite v8.0 and Oxc toolchain updates (Oxlint `1.89.0` and Oxfmt `0.74.0`), we evaluated whether to:

1. Retain Oxlint + Oxfmt versus migrating to Biome or returning to ESLint v9 flat config.
2. Adopt type-aware linting (`oxlint-tsgolint`).
3. Retain, clean, or adapt React Native-specific overrides.

## Decision

We update and consolidate the tooling configuration as follows:

1. **Reaffirm Oxlint + Oxfmt via Ultracite**:
   - We upgrade dependencies to `ultracite@^8.0.1`, `oxlint@^1.89.0`, `oxfmt@^0.74.0`, and `oxlint-plugin-react-native@^0.2.39`.
   - We retain Oxlint as the primary linter and Oxfmt as the formatter, achieving sub-300ms lint passes across 84 files (526 rules) and sub-50ms formatting across 108 files.

2. **Defer Type-Aware Linting (`oxlint-tsgolint`)**:
   - Typechecking remains exclusively the responsibility of TypeScript compiler (`tsc --noEmit`).
   - Oxlint runs strictly in syntactic/AST mode to preserve sub-second pre-commit feedback loops.

3. **Prune Obsolete Overrides & Retain Mobile Invariants**:
   - We remove obsolete workarounds: `import/namespace: off`, `vitest/prefer-called-once: off`, and root `jest/require-hook: off`.
   - We retain `typescript/no-use-before-define: ["error", { variables: false }]` to support idiomatic React Native `StyleSheet.create` definitions at the bottom of component files.
   - We retain `oxlint-plugin-react-native` with custom component skips for `react-native/no-raw-text` (`Link`, `FieldTitle`, `FieldLabel`, etc.) to prevent runtime native crashes from orphaned text nodes.
   - We selectively disable React Compiler rules (`react/immutability`, `react/refs`, `react/memo-dependencies`, `react/purity`) and function component expression enforcement that conflict with Expo Router screen exports and imperative timer refs.

4. **Code Quality Enhancements**:
   - Modernized numeric parsing across `components/input-thumbwheel.tsx`, `components/input-time.tsx`, and `helpers/timer/utils/formatter.ts` using `Number()` and `Math.trunc()`.
   - Refactored `TimerStrategy` to use property signature style (`calculateState: (event: TickEvent) => TimerState`).
   - Cleaned up unneeded effect dependencies in `components/input-thumbwheel.tsx`.

## Consequences

- **Positive**:
  - Eliminates 15+ lines of obsolete defensive configuration.
  - Fixes upstream formatting and rule discrepancies without regressions.
  - Preserves 100% deterministic test execution (30 passed tests) and clean TypeScript typechecks.
  - Maintains `pre-commit` and `pre-push` execution times under 1 second.
- **Negative**:
  - Ultracite continues to lack an official `react-native` preset, requiring explicit maintenance of the React Native JS plugin and style hoisting overrides in `oxlint.config.ts`.
