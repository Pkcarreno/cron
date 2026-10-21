# ADR 0004: Migration from `@gorhom/bottom-sheet` to `@lodev09/react-native-true-sheet`

- **Status**: Accepted
- **Date**: October 2026
- **Context**: Expo SDK 58 (`58.0.16`), React Native 0.88.0, New Architecture (Fabric)

## Context

Upgrading across Expo SDK releases and React Native minor versions has repeatedly identified `@gorhom/bottom-sheet` as an upgrade bottleneck due to its architectural coupling:

1. **Worklet & Reanimated Internals**: The library tightly couples its state machine to specific versions of `react-native-reanimated` and `react-native-worklets`, often lagging behind upstream releases (as documented during our Expo SDK 57 and SDK 58 evaluations in [`docs/research/expo-upgrade-evaluation.md`](file:///home/pk/Projects/cron/docs/research/expo-upgrade-evaluation.md)).
2. **Gesture Handler Deprecations**: The migration to `react-native-gesture-handler` v3 in SDK 58 deprecates the Builder API, creating friction with JS-driven gesture tracking.
3. **Root Provider Overhead**: Requiring `<BottomSheetModalProvider>` at the root of [`app/_layout.tsx`](file:///home/pk/Projects/cron/app/_layout.tsx) injects global context for an interaction used in only one isolated place in the app.

An architectural audit of the `cron` codebase revealed that `@gorhom/bottom-sheet` is completely isolated inside [`components/sheet.tsx`](file:///home/pk/Projects/cron/components/sheet.tsx), which provides a Radix-like declarative abstraction (`<Sheet>`, `<SheetTrigger>`, `<SheetContent>`). The only active consumer is [`components/input-number.tsx`](file:///home/pk/Projects/cron/components/input-number.tsx) (`NumberPickerSheet`) with dynamic height sizing (`enableDynamicSizing={true}`).

Following the research in [`docs/research/bottom-sheet-alternatives-evaluation.md`](file:///home/pk/Projects/cron/docs/research/bottom-sheet-alternatives-evaluation.md) and our design stress-testing sessions, we replace `@gorhom/bottom-sheet` with `@lodev09/react-native-true-sheet`.

## Decision

We adopt `@lodev09/react-native-true-sheet` with the following architectural specifications:

### 1. Zero Reanimated/RNGH Coupling

We eliminate all JavaScript-thread gesture physics and worklets for bottom sheets. `TrueSheet` wraps platform-native sheet primitives:

- **iOS**: `UISheetPresentationController` (native system fluid springs and grabber).
- **Android**: Google Material `BottomSheetDialog` / `BottomSheetBehavior`.

### 2. Preserve Declarative Component Facade

The external API contract of [`components/sheet.tsx`](file:///home/pk/Projects/cron/components/sheet.tsx) remains strictly backwards-compatible:

- Controlled & uncontrolled states: `<Sheet open={open} onOpenChange={setOpen}>`.
- Trigger composition: `<SheetTrigger asChild>`.
- Content & layout slots: `<SheetContent>`, `<SheetHeader>`, `<SheetTitle>`, `<SheetDescription>`.
- Internal implementation translates `open` prop changes into imperative `sheetRef.current.present()` and `sheetRef.current.dismiss()` calls without leaking implementation details to consumers.
- No modifications are required in [`components/input-number.tsx`](file:///home/pk/Projects/cron/components/input-number.tsx) or screens ([`screens/settings/index.tsx`](file:///home/pk/Projects/cron/screens/settings/index.tsx), [`screens/menu/index.tsx`](file:///home/pk/Projects/cron/screens/menu/index.tsx)).

### 3. Native Detents & Layout Invariants

- **Dynamic Sizing**: Default to `detents={['auto']}` to tightly fit content without creating arbitrary empty bottom space in compact pickers.
- **Surface Styling**: Use solid tokenized background (`backgroundColor: colors.neutral[900]`) and uniform `cornerRadius={24}`.
- **Safe Area Insets**: Delegate Home Indicator and system bar padding to the native sheet container (using a modest base `paddingBottom: 24`), avoiding duplicated insets from manual `insets.bottom` additions.

### 4. Root Tree Simplification

- Remove `<BottomSheetModalProvider>` from [`app/_layout.tsx`](file:///home/pk/Projects/cron/app/_layout.tsx).

### 5. Deterministic Unit Testing Strategy

- Adopt the library's official built-in mock in [`jest.setup.ts`](file:///home/pk/Projects/cron/jest.setup.ts):
  ```ts
  jest.mock("@lodev09/react-native-true-sheet", () =>
    require("@lodev09/react-native-true-sheet/mock")
  );
  ```
- Remove the obsolete `@gorhom/bottom-sheet/mock` mapping.

## Acceptance Criteria

1. **Dependency Hygiene**:
   - `pnpm add @lodev09/react-native-true-sheet` installed.
   - `pnpm remove @gorhom/bottom-sheet` executed.
   - Zero imports of `@gorhom/bottom-sheet` remaining in the repository (`git grep "bottom-sheet"` yields only historical docs).
2. **Behavioral Parity**:
   - `NumberPickerSheet` opens and dismisses with identical UX in `screens/settings` and `screens/menu`.
   - Backdrop tap or drag-down dismisses the sheet and triggers `onOpenChange(false)`.
3. **Verification**:
   - All existing unit tests pass: `pnpm test`.
   - TypeScript compilation succeeds: `pnpm typecheck` (zero errors).
   - Code standards pass: `pnpm lint` (zero Ultracite/Oxlint violations).

## Consequences

- **Positive**:
  - **Upgrade Immunity**: Bottom sheets are completely insulated from future `react-native-reanimated` and `react-native-gesture-handler` breaking changes.
  - **Native Performance**: 120 FPS hardware-accelerated transitions on UIKit and Android View hierarchy.
  - **Native Keyboard Avoidance**: Focus in `TextInput` elements avoids the keyboard natively without custom JS offset recalculations.
  - **Leaner Hierarchy**: Eliminates an unneeded global provider from the root layout.
- **Negative**:
  - **Platform Variance**: Sheet styling and motion follow platform guidelines (iOS HIG vs Android Material) rather than 1:1 identical cross-platform pixels.
