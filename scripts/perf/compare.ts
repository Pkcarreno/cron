import fs from "node:fs/promises";

import { DEFAULT_BUDGET_THRESHOLDS } from "./types";
import type {
  BenchmarkResult,
  BudgetThresholds,
  BudgetViolation,
  CompareOptions,
  CompareResult,
  ComparisonReport,
  MetricDelta,
} from "./types";
import { isDirectScriptExecution } from "./utils";

/* oxlint-disable no-redeclare */
export const CompareExitCode = {
  BUDGET_VIOLATION: 2,
  INVALID_INPUT: 1,
  SUCCESS: 0,
} as const;

export type CompareExitCode =
  (typeof CompareExitCode)[keyof typeof CompareExitCode];
/* oxlint-enable no-redeclare */

export const USAGE_TEXT = `
Usage: pnpm perf:compare <baseline.json> <candidate.json> [options]

Arguments:
  <baseline.json>              Path to baseline BenchmarkResult JSON file
  <candidate.json>             Path to candidate BenchmarkResult JSON file

Options:
  --fail-on-violation          Exit with non-zero status code if performance budgets are exceeded
  --threshold-jank <percent>   Custom max jank percentage threshold (default: 2.0)
  --threshold-js-cpu <percent> Custom max JS thread CPU utilization threshold (default: 15.0)
  --threshold-frame-120 <ms>   Max frame time in ms at 120 Hz (default: 8.33)
  --threshold-frame-60 <ms>    Max frame time in ms at 60 Hz (default: 16.67)
  --help, -h                   Display this help message
`.trim();

/**
 * Calculates absolute and percentage deltas between baseline and candidate metrics.
 *
 * Negative deltas indicate performance improvements (shorter frame times, lower CPU load).
 * Positive deltas indicate performance regressions.
 *
 * @param baseline - Baseline benchmark metric measurement.
 * @param candidate - Candidate benchmark metric measurement.
 * @returns Object with baseline, candidate, absolute delta, and percentage delta.
 */
export const calculateMetricDelta = (
  baseline: number,
  candidate: number
): MetricDelta => {
  const delta = Number((candidate - baseline).toFixed(2));
  let deltaPercent = 0;
  if (baseline === 0) {
    deltaPercent = candidate === 0 ? 0 : 100;
  } else {
    deltaPercent = Number(
      (((candidate - baseline) / baseline) * 100).toFixed(2)
    );
  }

  return {
    baseline,
    candidate,
    delta,
    deltaPercent,
  };
};

export const formatMetricValue = (value: number, unit: string): string => {
  const formatted = value.toFixed(2);
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
};

export const formatDeltaValue = (value: number, unit: string): string => {
  const formatted = value.toFixed(2);
  const sign = value > 0 ? "+" : "";
  return unit === "%" ? `${sign}${formatted}%` : `${sign}${formatted} ${unit}`;
};

export const formatDeltaPercent = (value: number): string => {
  const formatted = value.toFixed(2);
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatted}%`;
};

const formatLimit = (limit: number): string =>
  limit % 1 === 0 ? limit.toString() : limit.toFixed(2);

/**
 * Evaluates benchmark metrics against soft performance budget gates.
 *
 * Budget thresholds:
 * - Frame budget: 8.33 ms (120 Hz display) or 16.67 ms (60 Hz display).
 * - Jank percentage: <= 2.0% dropped frames.
 * - JS thread CPU utilization: <= 15.0% during continuous gesture scenarios.
 *
 * @param candidate - Candidate benchmark result containing observed metrics.
 * @param refreshRateHz - Connected device screen refresh rate (60 Hz or 120 Hz).
 * @param customThresholds - Optional overrides for budget limits.
 * @returns Budget validation status and list of specific gate violations.
 */
export const evaluateBudgetGates = (
  candidate: BenchmarkResult,
  refreshRateHz: number,
  customThresholds?: Partial<BudgetThresholds>
): { isPassingBudgets: boolean; violations: BudgetViolation[] } => {
  const thresholds: BudgetThresholds = {
    ...DEFAULT_BUDGET_THRESHOLDS,
    ...customThresholds,
    frameBudgetMs: {
      ...DEFAULT_BUDGET_THRESHOLDS.frameBudgetMs,
      ...customThresholds?.frameBudgetMs,
    },
  };

  const violations: BudgetViolation[] = [];
  const frameBudgetLimit =
    refreshRateHz === 120
      ? thresholds.frameBudgetMs[120]
      : thresholds.frameBudgetMs[60];

  const actualP90 = candidate.metrics.frameTime.p90Ms;
  if (actualP90 > frameBudgetLimit) {
    violations.push({
      actual: actualP90,
      limit: frameBudgetLimit,
      message: `Frame time P90 (${actualP90.toFixed(2)} ms) exceeds ${refreshRateHz} Hz budget limit of ${formatLimit(frameBudgetLimit)} ms.`,
      type: "FRAME_BUDGET",
      unit: "ms",
    });
  }

  const actualP99 = candidate.metrics.frameTime.p99Ms;
  if (actualP99 > frameBudgetLimit) {
    violations.push({
      actual: actualP99,
      limit: frameBudgetLimit,
      message: `Frame time P99 (${actualP99.toFixed(2)} ms) exceeds ${refreshRateHz} Hz budget limit of ${formatLimit(frameBudgetLimit)} ms.`,
      type: "FRAME_BUDGET",
      unit: "ms",
    });
  }

  const actualJank = candidate.metrics.jankPercentage;
  if (actualJank > thresholds.jankRateMaxPercent) {
    violations.push({
      actual: actualJank,
      limit: thresholds.jankRateMaxPercent,
      message: `Jank rate (${actualJank.toFixed(2)}%) exceeds budget limit of ${formatLimit(thresholds.jankRateMaxPercent)}%.`,
      type: "JANK_RATE",
      unit: "%",
    });
  }

  const actualJsCpu = candidate.metrics.cpu.jsThreadCpuPercent;
  if (actualJsCpu > thresholds.jsThreadCpuMaxPercent) {
    violations.push({
      actual: actualJsCpu,
      limit: thresholds.jsThreadCpuMaxPercent,
      message: `JS thread CPU (${actualJsCpu.toFixed(2)}%) exceeds budget limit of ${formatLimit(thresholds.jsThreadCpuMaxPercent)}% during gestures.`,
      type: "JS_THREAD_CPU",
      unit: "%",
    });
  }

  return {
    isPassingBudgets: violations.length === 0,
    violations,
  };
};

/**
 * Computes comparative performance report between baseline and candidate benchmark runs.
 *
 * @param baseline - Baseline benchmark run result.
 * @param candidate - Candidate benchmark run result to evaluate.
 * @param customThresholds - Optional custom thresholds for budget evaluations.
 * @returns Structured comparison report containing deltas, refresh rate, and budget violations.
 */
export const generateComparisonReport = (
  baseline: BenchmarkResult,
  candidate: BenchmarkResult,
  customThresholds?: Partial<BudgetThresholds>
): ComparisonReport => {
  const refreshRateHz =
    candidate.device?.refreshRateHz ?? baseline.device?.refreshRateHz ?? 60;

  const { isPassingBudgets, violations } = evaluateBudgetGates(
    candidate,
    refreshRateHz,
    customThresholds
  );

  const scenario =
    candidate.scenario === baseline.scenario
      ? candidate.scenario
      : `${baseline.scenario} vs ${candidate.scenario}`;

  return {
    baselineCommit: baseline.commit,
    candidateCommit: candidate.commit,
    deltas: {
      cpuJsThread: calculateMetricDelta(
        baseline.metrics.cpu.jsThreadCpuPercent,
        candidate.metrics.cpu.jsThreadCpuPercent
      ),
      cpuTotal: calculateMetricDelta(
        baseline.metrics.cpu.totalCpuPercent,
        candidate.metrics.cpu.totalCpuPercent
      ),
      cpuUiThread: calculateMetricDelta(
        baseline.metrics.cpu.uiThreadCpuPercent,
        candidate.metrics.cpu.uiThreadCpuPercent
      ),
      frameTimeP50: calculateMetricDelta(
        baseline.metrics.frameTime.p50Ms,
        candidate.metrics.frameTime.p50Ms
      ),
      frameTimeP90: calculateMetricDelta(
        baseline.metrics.frameTime.p90Ms,
        candidate.metrics.frameTime.p90Ms
      ),
      frameTimeP99: calculateMetricDelta(
        baseline.metrics.frameTime.p99Ms,
        candidate.metrics.frameTime.p99Ms
      ),
      jankPercentage: calculateMetricDelta(
        baseline.metrics.jankPercentage,
        candidate.metrics.jankPercentage
      ),
    },
    isPassingBudgets,
    refreshRateHz,
    scenario,
    violations,
  };
};

export interface ComparisonTableRow {
  baseline: string;
  candidate: string;
  delta: string;
  deltaPercent: string;
  metric: string;
}

export const formatRow = ({
  baseline,
  candidate,
  delta,
  deltaPercent,
  metric,
}: ComparisonTableRow): string =>
  [
    metric.padEnd(20),
    baseline.padEnd(16),
    candidate.padEnd(16),
    delta.padEnd(16),
    deltaPercent.padEnd(12),
  ]
    .join("")
    .trimEnd();

/**
 * Formats a comparison report into an aligned terminal delta table with budget warnings.
 *
 * @param report - Structured comparison report to display.
 * @returns Human- and agent-readable formatted terminal table text.
 */
export const formatComparisonReport = (report: ComparisonReport): string => {
  const divider = "=".repeat(80);
  const subDivider = "-".repeat(80);

  const lines: string[] = [
    divider,
    "                      Performance Comparison Delta Report                       ",
    divider,
    `Scenario:      ${report.scenario}`,
    `Display:       ${report.refreshRateHz} Hz`,
    `Baseline:      ${report.baselineCommit}`,
    `Candidate:     ${report.candidateCommit}`,
    subDivider,
    formatRow({
      baseline: "Baseline",
      candidate: "Candidate",
      delta: "Delta",
      deltaPercent: "Delta %",
      metric: "Metric",
    }),
    subDivider,
  ];

  const tableRows: {
    delta: MetricDelta;
    label: string;
    unit: string;
  }[] = [
    {
      delta: report.deltas.frameTimeP50,
      label: "Frame Time P50",
      unit: "ms",
    },
    {
      delta: report.deltas.frameTimeP90,
      label: "Frame Time P90",
      unit: "ms",
    },
    {
      delta: report.deltas.frameTimeP99,
      label: "Frame Time P99",
      unit: "ms",
    },
    {
      delta: report.deltas.jankPercentage,
      label: "Jank Rate",
      unit: "%",
    },
    {
      delta: report.deltas.cpuUiThread,
      label: "UI Thread CPU",
      unit: "%",
    },
    {
      delta: report.deltas.cpuJsThread,
      label: "JS Thread CPU",
      unit: "%",
    },
    {
      delta: report.deltas.cpuTotal,
      label: "Total CPU",
      unit: "%",
    },
  ];

  for (const row of tableRows) {
    lines.push(
      formatRow({
        baseline: formatMetricValue(row.delta.baseline, row.unit),
        candidate: formatMetricValue(row.delta.candidate, row.unit),
        delta: formatDeltaValue(row.delta.delta, row.unit),
        deltaPercent: formatDeltaPercent(row.delta.deltaPercent),
        metric: row.label,
      })
    );
  }

  lines.push(divider);

  if (report.violations.length > 0) {
    lines.push(
      "                             Budget Gate Warnings                               ",
      divider
    );
    for (const violation of report.violations) {
      lines.push(`[WARNING] ${violation.type}: ${violation.message}`);
    }
    lines.push(
      subDivider,
      `Result: ${report.violations.length} budget gate violation${
        report.violations.length > 1 ? "s" : ""
      } detected. Action recommended: inspect worklet thread boundaries and frame drops.`,
      divider
    );
  } else {
    lines.push(
      "Budget Gates: All performance metrics within budget gates.",
      divider
    );
  }

  return lines.join("\n");
};

/**
 * Loads and validates a BenchmarkResult JSON file from the filesystem.
 *
 * @param filePath - Path to benchmark result JSON file.
 * @returns Parsed and validated BenchmarkResult.
 * @throws {Error} If file cannot be read, contains malformed JSON, or lacks required metrics fields.
 */
export const loadBenchmarkResult = async (
  filePath: string
): Promise<BenchmarkResult> => {
  let fileContent: string;
  try {
    fileContent = await fs.readFile(filePath, "utf-8");
  } catch {
    throw new Error(
      `Benchmark file not found at: ${filePath}. Make sure that you supply a valid benchmark JSON path.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    throw new Error(
      `Failed to parse benchmark JSON in ${filePath}: file contains invalid syntax.`
    );
  }

  const result = parsed as Partial<BenchmarkResult>;
  if (
    !result ||
    typeof result !== "object" ||
    typeof result.commit !== "string" ||
    typeof result.scenario !== "string" ||
    !result.metrics ||
    typeof result.metrics !== "object" ||
    typeof result.metrics.jankPercentage !== "number" ||
    !result.metrics.cpu ||
    typeof result.metrics.cpu.jsThreadCpuPercent !== "number" ||
    typeof result.metrics.cpu.uiThreadCpuPercent !== "number" ||
    typeof result.metrics.cpu.totalCpuPercent !== "number" ||
    !result.metrics.frameTime ||
    typeof result.metrics.frameTime.p50Ms !== "number" ||
    typeof result.metrics.frameTime.p90Ms !== "number" ||
    typeof result.metrics.frameTime.p99Ms !== "number"
  ) {
    throw new Error(
      `Malformed benchmark result in ${filePath}: missing required metrics fields.`
    );
  }

  return result as BenchmarkResult;
};

const parseThresholdArg = (
  arg: string,
  thresholdValueString: string,
  current: Partial<BudgetThresholds>
): Partial<BudgetThresholds> | null => {
  const optionValue = Number(thresholdValueString);
  if (Number.isNaN(optionValue)) {
    return null;
  }

  switch (arg) {
    case "--threshold-jank": {
      return { ...current, jankRateMaxPercent: optionValue };
    }
    case "--threshold-js-cpu": {
      return { ...current, jsThreadCpuMaxPercent: optionValue };
    }
    case "--threshold-frame-120": {
      return {
        ...current,
        frameBudgetMs: {
          ...DEFAULT_BUDGET_THRESHOLDS.frameBudgetMs,
          ...current.frameBudgetMs,
          120: optionValue,
        },
      };
    }
    case "--threshold-frame-60": {
      return {
        ...current,
        frameBudgetMs: {
          ...DEFAULT_BUDGET_THRESHOLDS.frameBudgetMs,
          ...current.frameBudgetMs,
          60: optionValue,
        },
      };
    }
    default: {
      return null;
    }
  }
};

/**
 * Parses command line arguments for the comparison runner CLI.
 *
 * @param args - Array of CLI argument strings.
 * @returns Extracted file paths, comparison options, and help flag.
 */
export const parseCompareCliArgs = (
  args: string[]
): {
  baselinePath?: string;
  candidatePath?: string;
  options: CompareOptions;
  shouldShowHelp: boolean;
} => {
  const options: CompareOptions = {
    customThresholds: {},
    shouldFailOnBudgetViolation: false,
  };
  let shouldShowHelp = false;
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      shouldShowHelp = true;
    } else if (arg === "--fail-on-violation") {
      options.shouldFailOnBudgetViolation = true;
    } else if (arg.startsWith("--threshold-") && i + 1 < args.length) {
      i += 1;
      const updated = parseThresholdArg(
        arg,
        args[i] ?? "",
        options.customThresholds ?? {}
      );
      if (updated) {
        options.customThresholds = updated;
      }
    } else if (!arg.startsWith("-")) {
      positionalArgs.push(arg);
    }
  }

  return {
    baselinePath: positionalArgs[0],
    candidatePath: positionalArgs[1],
    options,
    shouldShowHelp,
  };
};

export const parseCliArgs = parseCompareCliArgs;

/**
 * Runs performance comparison between baseline and candidate benchmark JSON files.
 *
 * @param baselinePath - Path to baseline benchmark JSON file.
 * @param candidatePath - Path to candidate benchmark JSON file.
 * @param options - Execution and reporting overrides.
 * @returns Result outcome including exit code, formatted terminal table, and report data.
 */
export const runCompare = async (
  baselinePath: string,
  candidatePath: string,
  options: CompareOptions = {}
): Promise<CompareResult> => {
  const reporter = options.reporter ?? console.log;

  let baseline: BenchmarkResult;
  let candidate: BenchmarkResult;

  try {
    baseline = await loadBenchmarkResult(baselinePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reporter(`[ERROR] Failed to load baseline benchmark: ${message}`);
    return {
      error: message,
      exitCode: CompareExitCode.INVALID_INPUT,
      formattedTable: "",
      isSuccess: false,
    };
  }

  try {
    candidate = await loadBenchmarkResult(candidatePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reporter(`[ERROR] Failed to load candidate benchmark: ${message}`);
    return {
      error: message,
      exitCode: CompareExitCode.INVALID_INPUT,
      formattedTable: "",
      isSuccess: false,
    };
  }

  const report = generateComparisonReport(
    baseline,
    candidate,
    options.customThresholds
  );
  const formattedTable = formatComparisonReport(report);

  reporter(formattedTable);

  const exitCode =
    !report.isPassingBudgets && options.shouldFailOnBudgetViolation
      ? CompareExitCode.BUDGET_VIOLATION
      : CompareExitCode.SUCCESS;

  return {
    exitCode,
    formattedTable,
    isSuccess: exitCode === CompareExitCode.SUCCESS,
    report,
  };
};

if (isDirectScriptExecution(import.meta.filename)) {
  void (async () => {
    try {
      const { baselinePath, candidatePath, options, shouldShowHelp } =
        parseCompareCliArgs(process.argv.slice(2));

      if (shouldShowHelp) {
        console.log(USAGE_TEXT);
        process.exit(CompareExitCode.SUCCESS);
      }

      if (!baselinePath || !candidatePath) {
        console.error(
          "Error: Missing required baseline and candidate JSON file arguments.\n"
        );
        console.log(USAGE_TEXT);
        process.exit(CompareExitCode.INVALID_INPUT);
      }

      const outcome = await runCompare(baselinePath, candidatePath, options);
      process.exit(outcome.exitCode);
    } catch (error) {
      console.error("Unexpected error in perf:compare:", error);
      process.exit(CompareExitCode.INVALID_INPUT);
    }
  })();
}
