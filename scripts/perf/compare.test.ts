import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  CompareExitCode,
  calculateMetricDelta,
  formatComparisonReport,
  formatDeltaPercent,
  formatDeltaValue,
  generateComparisonReport,
  loadBenchmarkResult,
  parseCliArgs,
  parseCompareCliArgs,
  runCompare,
} from "./compare";
import type { BenchmarkResult } from "./types";
import { isDirectScriptExecution } from "./utils";

const createValidBenchmark = (
  overrides?: Partial<BenchmarkResult>
): BenchmarkResult => ({
  commit: "a1b2c3d",
  device: {
    model: "Pixel 8 Pro",
    refreshRateHz: 120,
  },
  durationMs: 10_000,
  hasWarmupExecuted: true,
  iterationCount: 3,
  metrics: {
    cpu: {
      jsThreadCpuPercent: 4.5,
      totalCpuPercent: 25,
      uiThreadCpuPercent: 18,
    },
    frameTime: {
      p50Ms: 5.2,
      p90Ms: 7.1,
      p99Ms: 8,
    },
    jankPercentage: 0.8,
  },
  packageId: "com.pkcarreno.cron.preview",
  scenario: "thumbwheel-continuous-scroll",
  timestamp: "2026-10-28T12:00:00Z",
  ...overrides,
});

describe("Performance Comparison Delta Reporter (scripts/perf/compare)", () => {
  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "cron-compare-test-")
    );
  });

  afterEach(async () => {
    await fs.rm(tempDirectory, { force: true, recursive: true });
  });

  describe("calculateMetricDelta", () => {
    it("calculates improvement when candidate is lower than baseline", () => {
      const result = calculateMetricDelta(10, 8);
      expect(result.baseline).toBe(10);
      expect(result.candidate).toBe(8);
      expect(result.delta).toBe(-2);
      expect(result.deltaPercent).toBe(-20);
    });

    it("calculates regression when candidate is higher than baseline", () => {
      const result = calculateMetricDelta(10, 12);
      expect(result.baseline).toBe(10);
      expect(result.candidate).toBe(12);
      expect(result.delta).toBe(2);
      expect(result.deltaPercent).toBe(20);
    });

    it("calculates neutral change when candidate equals baseline", () => {
      const result = calculateMetricDelta(8.33, 8.33);
      expect(result.delta).toBe(0);
      expect(result.deltaPercent).toBe(0);
    });

    it("handles zero baseline safely without division by zero", () => {
      const zeroToValue = calculateMetricDelta(0, 5);
      expect(zeroToValue.delta).toBe(5);
      expect(zeroToValue.deltaPercent).toBe(100);

      const zeroToZero = calculateMetricDelta(0, 0);
      expect(zeroToZero.delta).toBe(0);
      expect(zeroToZero.deltaPercent).toBe(0);
    });
  });

  describe("formatDeltaValue and formatDeltaPercent", () => {
    it("formats positive delta with plus sign", () => {
      expect(formatDeltaValue(1.5, "ms")).toBe("+1.50 ms");
      expect(formatDeltaValue(2, "%")).toBe("+2.00%");
      expect(formatDeltaPercent(15.2)).toBe("+15.20%");
    });

    it("formats negative delta with minus sign", () => {
      expect(formatDeltaValue(-0.4, "ms")).toBe("-0.40 ms");
      expect(formatDeltaValue(-1.25, "%")).toBe("-1.25%");
      expect(formatDeltaPercent(-8.5)).toBe("-8.50%");
    });

    it("formats neutral delta with zero", () => {
      expect(formatDeltaValue(0, "ms")).toBe("0.00 ms");
      expect(formatDeltaValue(0, "%")).toBe("0.00%");
      expect(formatDeltaPercent(0)).toBe("0.00%");
    });
  });

  describe("generateComparisonReport", () => {
    it("generates comparison report with all metric deltas", () => {
      const baseline = createValidBenchmark({ commit: "base123" });
      const candidate = createValidBenchmark({
        commit: "cand456",
        metrics: {
          cpu: {
            jsThreadCpuPercent: 5,
            totalCpuPercent: 27,
            uiThreadCpuPercent: 19.5,
          },
          frameTime: {
            p50Ms: 5.5,
            p90Ms: 7.5,
            p99Ms: 8.2,
          },
          jankPercentage: 1,
        },
      });

      const report = generateComparisonReport(baseline, candidate);

      expect(report.baselineCommit).toBe("base123");
      expect(report.candidateCommit).toBe("cand456");
      expect(report.scenario).toBe("thumbwheel-continuous-scroll");
      expect(report.refreshRateHz).toBe(120);
      expect(report.isPassingBudgets).toBe(true);
      expect(report.violations).toHaveLength(0);

      expect(report.deltas.frameTimeP50.delta).toBe(0.3);
      expect(report.deltas.frameTimeP90.delta).toBe(0.4);
      expect(report.deltas.frameTimeP99.delta).toBe(0.2);
      expect(report.deltas.jankPercentage.delta).toBe(0.2);
      expect(report.deltas.cpuUiThread.delta).toBe(1.5);
      expect(report.deltas.cpuJsThread.delta).toBe(0.5);
      expect(report.deltas.cpuTotal.delta).toBe(2);
    });

    it("flags frame budget violation on 120 Hz display when P90 exceeds 8.33 ms", () => {
      const baseline = createValidBenchmark();
      const candidate = createValidBenchmark({
        metrics: {
          ...baseline.metrics,
          frameTime: {
            p50Ms: 6,
            p90Ms: 9.1,
            p99Ms: 8,
          },
        },
      });

      const report = generateComparisonReport(baseline, candidate);

      expect(report.isPassingBudgets).toBe(false);
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0]?.type).toBe("FRAME_BUDGET");
      expect(report.violations[0]?.actual).toBe(9.1);
      expect(report.violations[0]?.limit).toBe(8.33);
      expect(report.violations[0]?.message).toContain("8.33 ms");
    });

    it("flags frame budget violation on 120 Hz display when P99 exceeds 8.33 ms", () => {
      const baseline = createValidBenchmark();
      const candidate = createValidBenchmark({
        metrics: {
          ...baseline.metrics,
          frameTime: {
            p50Ms: 6,
            p90Ms: 7.5,
            p99Ms: 11,
          },
        },
      });

      const report = generateComparisonReport(baseline, candidate);

      expect(report.isPassingBudgets).toBe(false);
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0]?.type).toBe("FRAME_BUDGET");
      expect(report.violations[0]?.actual).toBe(11);
      expect(report.violations[0]?.limit).toBe(8.33);
      expect(report.violations[0]?.message).toContain(
        "P99 (11.00 ms) exceeds 120 Hz budget limit of 8.33 ms"
      );
    });

    it("flags frame budget violation on 60 Hz display when P90 exceeds 16.67 ms", () => {
      const baseline = createValidBenchmark({
        device: { model: "Pixel 4", refreshRateHz: 60 },
      });
      const candidate = createValidBenchmark({
        device: { model: "Pixel 4", refreshRateHz: 60 },
        metrics: {
          ...baseline.metrics,
          frameTime: {
            p50Ms: 12,
            p90Ms: 18.2,
            p99Ms: 16,
          },
        },
      });

      const report = generateComparisonReport(baseline, candidate);

      expect(report.isPassingBudgets).toBe(false);
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0]?.type).toBe("FRAME_BUDGET");
      expect(report.violations[0]?.actual).toBe(18.2);
      expect(report.violations[0]?.limit).toBe(16.67);
      expect(report.violations[0]?.message).toContain("16.67 ms");
    });

    it("flags jank rate violation when jank exceeds 2.0%", () => {
      const baseline = createValidBenchmark();
      const candidate = createValidBenchmark({
        metrics: {
          ...baseline.metrics,
          jankPercentage: 2.8,
        },
      });

      const report = generateComparisonReport(baseline, candidate);

      expect(report.isPassingBudgets).toBe(false);
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0]?.type).toBe("JANK_RATE");
      expect(report.violations[0]?.actual).toBe(2.8);
      expect(report.violations[0]?.limit).toBe(2);
      expect(report.violations[0]?.message).toContain("2%");
    });

    it("flags JS thread CPU violation when utilization exceeds 15%", () => {
      const baseline = createValidBenchmark();
      const candidate = createValidBenchmark({
        metrics: {
          ...baseline.metrics,
          cpu: {
            ...baseline.metrics.cpu,
            jsThreadCpuPercent: 18.5,
          },
        },
      });

      const report = generateComparisonReport(baseline, candidate);

      expect(report.isPassingBudgets).toBe(false);
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0]?.type).toBe("JS_THREAD_CPU");
      expect(report.violations[0]?.actual).toBe(18.5);
      expect(report.violations[0]?.limit).toBe(15);
      expect(report.violations[0]?.message).toContain("15%");
    });

    it("flags multiple simultaneous budget violations", () => {
      const baseline = createValidBenchmark();
      const candidate = createValidBenchmark({
        metrics: {
          cpu: {
            jsThreadCpuPercent: 22,
            totalCpuPercent: 40,
            uiThreadCpuPercent: 25,
          },
          frameTime: {
            p50Ms: 7,
            p90Ms: 10.5,
            p99Ms: 8,
          },
          jankPercentage: 3.5,
        },
      });

      const report = generateComparisonReport(baseline, candidate);

      expect(report.isPassingBudgets).toBe(false);
      expect(report.violations).toHaveLength(3);
      expect(report.violations.map((v) => v.type)).toEqual([
        "FRAME_BUDGET",
        "JANK_RATE",
        "JS_THREAD_CPU",
      ]);
    });

    it("supports custom budget thresholds", () => {
      const baseline = createValidBenchmark();
      const candidate = createValidBenchmark({
        metrics: {
          ...baseline.metrics,
          jankPercentage: 1.5,
        },
      });

      // Default passes with 1.5% <= 2.0%
      const defaultReport = generateComparisonReport(baseline, candidate);
      expect(defaultReport.isPassingBudgets).toBe(true);

      // Custom strict threshold of 1.0% triggers violation
      const strictReport = generateComparisonReport(baseline, candidate, {
        jankRateMaxPercent: 1,
      });
      expect(strictReport.isPassingBudgets).toBe(false);
      expect(strictReport.violations[0]?.type).toBe("JANK_RATE");
    });
  });

  describe("formatComparisonReport", () => {
    it("formats clean delta table with proper column headers and alignment", () => {
      const baseline = createValidBenchmark({ commit: "abc111" });
      const candidate = createValidBenchmark({
        commit: "def222",
        metrics: {
          cpu: {
            jsThreadCpuPercent: 3.8,
            totalCpuPercent: 22,
            uiThreadCpuPercent: 16,
          },
          frameTime: {
            p50Ms: 4.8,
            p90Ms: 6.9,
            p99Ms: 7.8,
          },
          jankPercentage: 0.5,
        },
      });

      const report = generateComparisonReport(baseline, candidate);
      const output = formatComparisonReport(report);

      expect(output).toContain("thumbwheel-continuous-scroll");
      expect(output).toContain("120 Hz");
      expect(output).toContain("abc111");
      expect(output).toContain("def222");
      expect(output).toContain("Frame Time P50");
      expect(output).toContain("Frame Time P90");
      expect(output).toContain("Frame Time P99");
      expect(output).toContain("Jank Rate");
      expect(output).toContain("UI Thread CPU");
      expect(output).toContain("JS Thread CPU");
      expect(output).toContain("Total CPU");
      expect(output).toContain("All performance metrics within budget gates.");
    });

    it("formats visible warning section when budget violations exist", () => {
      const baseline = createValidBenchmark();
      const candidate = createValidBenchmark({
        metrics: {
          ...baseline.metrics,
          cpu: {
            ...baseline.metrics.cpu,
            jsThreadCpuPercent: 19,
          },
          frameTime: {
            p50Ms: 6,
            p90Ms: 9.8,
            p99Ms: 12,
          },
          jankPercentage: 3.2,
        },
      });

      const report = generateComparisonReport(baseline, candidate);
      const output = formatComparisonReport(report);

      expect(output).toContain("Budget Gate Warnings");
      expect(output).toContain("[WARNING] FRAME_BUDGET");
      expect(output).toContain("[WARNING] JANK_RATE");
      expect(output).toContain("[WARNING] JS_THREAD_CPU");
      expect(output).toContain("Action recommended");
    });
  });

  describe("loadBenchmarkResult", () => {
    it("loads and parses valid JSON benchmark file", async () => {
      const validData = createValidBenchmark();
      const filePath = path.join(tempDirectory, "valid-benchmark.json");
      await fs.writeFile(filePath, JSON.stringify(validData, null, 2), "utf-8");

      const loaded = await loadBenchmarkResult(filePath);
      expect(loaded.commit).toBe("a1b2c3d");
      expect(loaded.metrics.frameTime.p90Ms).toBe(7.1);
    });

    it("throws clear error when benchmark file does not exist", async () => {
      const nonexistentPath = path.join(tempDirectory, "missing.json");
      await expect(loadBenchmarkResult(nonexistentPath)).rejects.toThrow(
        "Benchmark file not found"
      );
    });

    it("throws clear error when benchmark file contains malformed JSON", async () => {
      const malformedPath = path.join(tempDirectory, "corrupted.json");
      await fs.writeFile(malformedPath, "{ invalid json content ...", "utf-8");

      await expect(loadBenchmarkResult(malformedPath)).rejects.toThrow(
        "Failed to parse benchmark JSON"
      );
    });

    it("throws clear error when benchmark file is missing required metrics fields", async () => {
      const incompletePath = path.join(tempDirectory, "incomplete.json");
      await fs.writeFile(
        incompletePath,
        JSON.stringify({ commit: "abc", scenario: "test" }),
        "utf-8"
      );

      await expect(loadBenchmarkResult(incompletePath)).rejects.toThrow(
        "Malformed benchmark result"
      );
    });
  });

  describe("runCompare", () => {
    it("runs comparison successfully with clean exit code 0 when budgets pass", async () => {
      const basePath = path.join(tempDirectory, "baseline.json");
      const candPath = path.join(tempDirectory, "candidate.json");

      await fs.writeFile(
        basePath,
        JSON.stringify(createValidBenchmark()),
        "utf-8"
      );
      await fs.writeFile(
        candPath,
        JSON.stringify(createValidBenchmark({ commit: "candidate789" })),
        "utf-8"
      );

      const reporter = jest.fn();
      const result = await runCompare(basePath, candPath, { reporter });

      expect(result.exitCode).toBe(CompareExitCode.SUCCESS);
      expect(result.isSuccess).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report?.isPassingBudgets).toBe(true);
      expect(reporter).toHaveBeenCalledWith(
        expect.stringContaining("thumbwheel-continuous-scroll")
      );
    });

    it("emits visible warnings but exits with 0 under soft budget mode when budgets are violated", async () => {
      const basePath = path.join(tempDirectory, "baseline.json");
      const candPath = path.join(tempDirectory, "candidate.json");

      await fs.writeFile(
        basePath,
        JSON.stringify(createValidBenchmark()),
        "utf-8"
      );
      await fs.writeFile(
        candPath,
        JSON.stringify(
          createValidBenchmark({
            metrics: {
              ...createValidBenchmark().metrics,
              jankPercentage: 4.5,
            },
          })
        ),
        "utf-8"
      );

      const reporter = jest.fn();
      const result = await runCompare(basePath, candPath, { reporter });

      expect(result.exitCode).toBe(CompareExitCode.SUCCESS);
      expect(result.isSuccess).toBe(true);
      expect(result.report?.isPassingBudgets).toBe(false);
      expect(result.report?.violations).toHaveLength(1);
      expect(reporter).toHaveBeenCalledWith(
        expect.stringContaining("Budget Gate Warnings")
      );
    });

    it("returns exitCode=2 (BUDGET_VIOLATION) when failOnBudgetViolation is true", async () => {
      const basePath = path.join(tempDirectory, "baseline.json");
      const candPath = path.join(tempDirectory, "candidate.json");

      await fs.writeFile(
        basePath,
        JSON.stringify(createValidBenchmark()),
        "utf-8"
      );
      await fs.writeFile(
        candPath,
        JSON.stringify(
          createValidBenchmark({
            metrics: {
              ...createValidBenchmark().metrics,
              jankPercentage: 3.8,
            },
          })
        ),
        "utf-8"
      );

      const reporter = jest.fn();
      const result = await runCompare(basePath, candPath, {
        reporter,
        shouldFailOnBudgetViolation: true,
      });

      expect(result.exitCode).toBe(CompareExitCode.BUDGET_VIOLATION);
      expect(result.isSuccess).toBe(false);
      expect(result.report?.isPassingBudgets).toBe(false);
    });

    it("returns exitCode=1 (INVALID_INPUT) when baseline file does not exist", async () => {
      const basePath = path.join(tempDirectory, "missing.json");
      const candPath = path.join(tempDirectory, "candidate.json");
      await fs.writeFile(
        candPath,
        JSON.stringify(createValidBenchmark()),
        "utf-8"
      );

      const reporter = jest.fn();
      const result = await runCompare(basePath, candPath, { reporter });

      expect(result.exitCode).toBe(CompareExitCode.INVALID_INPUT);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain("Benchmark file not found");
      expect(reporter).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load baseline benchmark")
      );
    });

    it("returns exitCode=1 (INVALID_INPUT) when candidate file contains corrupt JSON", async () => {
      const basePath = path.join(tempDirectory, "baseline.json");
      const candPath = path.join(tempDirectory, "corrupt.json");
      await fs.writeFile(
        basePath,
        JSON.stringify(createValidBenchmark()),
        "utf-8"
      );
      await fs.writeFile(candPath, "{ not valid json", "utf-8");

      const reporter = jest.fn();
      const result = await runCompare(basePath, candPath, { reporter });

      expect(result.exitCode).toBe(CompareExitCode.INVALID_INPUT);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain("Failed to parse benchmark JSON");
      expect(reporter).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load candidate benchmark")
      );
    });
  });

  describe("parseCompareCliArgs", () => {
    it("parses positional paths for baseline and candidate", () => {
      const parsed = parseCompareCliArgs(["base.json", "cand.json"]);
      expect(parsed.baselinePath).toBe("base.json");
      expect(parsed.candidatePath).toBe("cand.json");
      expect(parsed.options.shouldFailOnBudgetViolation).toBe(false);
      expect(parsed.shouldShowHelp).toBe(false);

      const aliasParsed = parseCliArgs(["base.json", "cand.json"]);
      expect(aliasParsed.shouldShowHelp).toBe(false);
    });

    it("parses --fail-on-violation flag", () => {
      const parsed = parseCompareCliArgs([
        "base.json",
        "cand.json",
        "--fail-on-violation",
      ]);
      expect(parsed.options.shouldFailOnBudgetViolation).toBe(true);
    });

    it("parses --help and -h flags", () => {
      expect(parseCompareCliArgs(["--help"]).shouldShowHelp).toBe(true);
      expect(parseCompareCliArgs(["-h"]).shouldShowHelp).toBe(true);
      expect(parseCliArgs(["--help"]).shouldShowHelp).toBe(true);
    });

    it("parses custom thresholds flags", () => {
      const parsed = parseCompareCliArgs([
        "base.json",
        "cand.json",
        "--threshold-jank",
        "1.5",
        "--threshold-js-cpu",
        "12",
        "--threshold-frame-120",
        "8",
        "--threshold-frame-60",
        "16",
      ]);
      expect(parsed.options.customThresholds?.jankRateMaxPercent).toBe(1.5);
      expect(parsed.options.customThresholds?.jsThreadCpuMaxPercent).toBe(12);
      expect(parsed.options.customThresholds?.frameBudgetMs?.["120"]).toBe(8);
      expect(parsed.options.customThresholds?.frameBudgetMs?.["60"]).toBe(16);
    });
  });

  describe("isDirectScriptExecution", () => {
    it("returns boolean reflecting script entry point comparison", () => {
      const result = isDirectScriptExecution();
      expect(typeof result).toBe("boolean");
    });
  });
});
