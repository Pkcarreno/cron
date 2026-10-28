/* oxlint-disable unicorn/prefer-number-coercion, unicorn/prefer-number-properties */
// Cross-engine non-interactive settling sleep
const duration = parseInt(
  typeof durationMs === "undefined" ? "1000" : durationMs,
  10
);
try {
  // Prefer non-busy Java Thread sleep when running on JVM Rhino / GraalJS engine
  java.lang.Thread.sleep(duration);
} catch {
  // Fallback to busy-wait if Java interop is unavailable
  const start = Date.now();
  while (Date.now() - start < duration) {
    // Wait for duration to elapse
  }
}
