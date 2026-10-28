/* oxlint-disable unicorn/prefer-number-coercion, unicorn/prefer-number-properties */
const duration = parseInt(durationMs || "1000", 10);
const start = Date.now();
while (Date.now() - start < duration) {
  // synchronous sleep without touch events
}
