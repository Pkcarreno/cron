import type { FormInsets } from "./types";

/**
 * Metric constants for computing deterministic layout insets for the form pager.
 * Eliminates layout thrashing and first-frame visual flicker by avoiding runtime onLayout measurements.
 */
export const MENU_HEADER_METRICS = {
  headerMarginBottom: 16,
  headerTitleHeight: 58,
  jobLabelHeight: 18,
  jobMarginBottom: 12,
  tabBarHeight: 36,
  tabBarMarginBottom: 16,
} as const;

export const MENU_DOCK_METRICS = {
  dockHeight: 56,
  dockMarginBottom: 24,
  dockPaddingTop: 16,
  minBottomInset: 128,
} as const;

/**
 * Compute the top content inset deterministically from the safe area top inset and header metrics.
 */
export const getMenuTopInset = (safeAreaTop: number): number =>
  safeAreaTop +
  MENU_HEADER_METRICS.headerTitleHeight +
  MENU_HEADER_METRICS.headerMarginBottom +
  MENU_HEADER_METRICS.jobLabelHeight +
  MENU_HEADER_METRICS.jobMarginBottom +
  MENU_HEADER_METRICS.tabBarHeight +
  MENU_HEADER_METRICS.tabBarMarginBottom;

/**
 * Compute the bottom content inset deterministically from the safe area bottom inset and dock metrics.
 */
export const getMenuBottomInset = (safeAreaBottom: number): number =>
  Math.max(MENU_DOCK_METRICS.minBottomInset, 102 + safeAreaBottom + 24);

/**
 * Computes deterministic form insets combining safe area insets and metric constants.
 */
export const computeDeterministicInsets = (safeAreaInsets: {
  top: number;
  bottom: number;
}): FormInsets => ({
  bottom: getMenuBottomInset(safeAreaInsets.bottom),
  top: getMenuTopInset(safeAreaInsets.top),
});
