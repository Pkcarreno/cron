import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as setTimeoutPromise } from "node:timers/promises";

import type {
  BenchmarkResult,
  CommandExecutor,
  CpuMetrics,
  FrameTimeMetrics,
  MeasureOptions,
} from "./types";
import {
  defaultExecutor,
  isDirectScriptExecution,
  resolveGitCommitSha,
} from "./utils";

export type SleepFunction = (ms: number) => Promise<void>;

export const defaultSleep: SleepFunction = async (
  ms: number
): Promise<void> => {
  await setTimeoutPromise(ms);
};

export interface StabilizationExecutionOptions {
  cooldownSleepMs?: number;
  deviceId?: string;
  executor: CommandExecutor;
  maestroBin?: string;
  packageId?: string;
  refreshRateHz?: 60 | 120;
  reporter?: (output: string) => void;
  scenarioPath: string;
  shouldWarmup?: boolean;
  sleepFn?: SleepFunction;
}

export interface ExtendedMeasureOptions extends MeasureOptions {
  sleepFn?: SleepFunction;
}

export interface ParsedGfxInfo {
  frameTime: FrameTimeMetrics;
  jankPercentage: number;
}

export interface RawFlashlightMeasure {
  cpu?: {
    perName?: Record<string, number>;
    total?: number;
  };
  fps?: number;
  time?: number;
}

export interface RawFlashlightIteration {
  measures?: RawFlashlightMeasure[];
}

export interface RawFlashlightResult {
  iterations?: RawFlashlightIteration[];
}

/**
 * Locks Android display refresh rate to fixed frequency (60 Hz or 120 Hz).
 *
 * Adaptive display refresh rates (LTPO) cause variable frame pacing and distorted
 * frame duration percentiles. Locking min and peak rates makes sure that VSYNC is deterministic.
 *
 * @param executor - Process execution adapter.
 * @param refreshRateHz - Target refresh rate in Hertz.
 * @param deviceId - Optional ADB target device serial number.
 */
export const lockDisplayRefreshRate = async (
  executor: CommandExecutor,
  refreshRateHz: 60 | 120 = 60,
  deviceId?: string
): Promise<void> => {
  const deviceArgs = deviceId ? ["-s", deviceId] : [];
  const rateValue = `${refreshRateHz}.0`;

  await executor("adb", [
    ...deviceArgs,
    "shell",
    "settings",
    "put",
    "system",
    "min_refresh_rate",
    rateValue,
  ]);

  await executor("adb", [
    ...deviceArgs,
    "shell",
    "settings",
    "put",
    "system",
    "peak_refresh_rate",
    rateValue,
  ]);
};

/**
 * Executes Android Runtime (ART) ahead-of-time (AOT) speed compilation.
 *
 * JIT compilation pauses introduce irregular frame drops and CPU spikes.
 * Compiling bytecode to native machine code makes sure that baseline execution is consistent.
 *
 * @param executor - Process execution adapter.
 * @param packageId - Android application package identifier.
 * @param deviceId - Optional ADB target device serial number.
 */
export const runArtCompilation = async (
  executor: CommandExecutor,
  packageId = "com.pkcarreno.cron.preview",
  deviceId?: string
): Promise<void> => {
  const deviceArgs = deviceId ? ["-s", deviceId] : [];

  await executor("adb", [
    ...deviceArgs,
    "shell",
    "cmd",
    "package",
    "compile",
    "-m",
    "speed",
    "-f",
    packageId,
  ]);
};

/**
 * Toggles Android device airplane mode to isolate network noise.
 *
 * Background synchronizations, push notifications, and network polling induce
 * uncontrollable thread scheduling interrupts during benchmark runs.
 *
 * @param executor - Process execution adapter.
 * @param isEnabled - Boolean flag indicating active airplane mode state.
 * @param deviceId - Optional ADB target device serial number.
 */
export const setAirplaneMode = async (
  executor: CommandExecutor,
  isEnabled: boolean,
  deviceId?: string
): Promise<void> => {
  const deviceArgs = deviceId ? ["-s", deviceId] : [];
  const action = isEnabled ? "enable" : "disable";

  await executor("adb", [
    ...deviceArgs,
    "shell",
    "cmd",
    "connectivity",
    "airplane-mode",
    action,
  ]);
};

/**
 * Executes an unmeasured interaction pass before metrics collection.
 *
 * Warmup pass initializes Hermes bytecode cache, native shared libraries (.so),
 * and JSI worklet runtimes so initial load latency does not bias measurements.
 *
 * @param executor - Process execution adapter.
 * @param scenarioPath - Path to Maestro YAML flow file.
 * @param maestroBin - Path or name of Maestro CLI binary.
 * @param deviceId - Optional ADB target device serial number.
 */
export const runWarmupPass = async (
  executor: CommandExecutor,
  scenarioPath: string,
  maestroBin = "maestro",
  deviceId?: string
): Promise<void> => {
  const deviceArgs = deviceId ? ["--device", deviceId] : [];
  await executor(maestroBin, ["test", ...deviceArgs, scenarioPath]);
};

/**
 * Resets SurfaceFlinger graphics metrics before starting collection pass.
 *
 * @param executor - Process execution adapter.
 * @param packageId - Android application package identifier.
 * @param deviceId - Optional ADB target device serial number.
 */
export const resetGfxInfo = async (
  executor: CommandExecutor,
  packageId = "com.pkcarreno.cron.preview",
  deviceId?: string
): Promise<void> => {
  const deviceArgs = deviceId ? ["-s", deviceId] : [];
  await executor("adb", [
    ...deviceArgs,
    "shell",
    "dumpsys",
    "gfxinfo",
    packageId,
    "reset",
  ]);
};

/**
 * Queries SurfaceFlinger graphics metrics for the specified application package.
 *
 * @param executor - Process execution adapter.
 * @param packageId - Android application package identifier.
 * @param deviceId - Optional ADB target device serial number.
 * @returns Raw stdout text of dumpsys gfxinfo.
 */
export const collectGfxInfo = async (
  executor: CommandExecutor,
  packageId = "com.pkcarreno.cron.preview",
  deviceId?: string
): Promise<string> => {
  const deviceArgs = deviceId ? ["-s", deviceId] : [];
  const result = await executor("adb", [
    ...deviceArgs,
    "shell",
    "dumpsys",
    "gfxinfo",
    packageId,
  ]);
  return result.stdout;
};

/**
 * Parses dumpsys gfxinfo output into frame duration percentiles and jank percentage.
 *
 * Android SurfaceFlinger captures hardware frame pacing. Percentile analysis
 * reveals median latency (p50) and outlier spikes (p90, p99) under load.
 *
 * @param output - Raw dumpsys gfxinfo output text.
 * @returns Parsed frame time metrics and jank percentage.
 */
export const parseGfxInfo = (output: string): ParsedGfxInfo => {
  const p50Match = output.match(
    /50th\s*percentile:\s*(?<metricValue>\d+(?:\.\d+)?)\s*ms/iu
  );
  const p90Match = output.match(
    /90th\s*percentile:\s*(?<metricValue>\d+(?:\.\d+)?)\s*ms/iu
  );
  const p99Match = output.match(
    /99th\s*percentile:\s*(?<metricValue>\d+(?:\.\d+)?)\s*ms/iu
  );
  const jankMatch = output.match(
    /Janky\s*frames:\s*\d+\s*\((?<metricValue>\d+(?:\.\d+)?)%\)/iu
  );

  const p50Ms = p50Match?.groups?.metricValue
    ? Number(p50Match.groups.metricValue)
    : 0;
  const p90Ms = p90Match?.groups?.metricValue
    ? Number(p90Match.groups.metricValue)
    : 0;
  const p99Ms = p99Match?.groups?.metricValue
    ? Number(p99Match.groups.metricValue)
    : 0;
  const jankPercentage = jankMatch?.groups?.metricValue
    ? Number(jankMatch.groups.metricValue)
    : 0;

  return {
    frameTime: {
      p50Ms,
      p90Ms,
      p99Ms,
    },
    jankPercentage,
  };
};

/**
 * Computes average CPU utilization across UI and Hermes JavaScript threads.
 *
 * Differentiates native Android UI thread utilization from Hermes JavaScript thread
 * utilization (`mqt_js` / `mqt_v_js`) to isolate Reanimated worklet execution.
 *
 * @param rawResult - Raw Flashlight iteration telemetry output.
 * @returns Structured CPU metrics breakdown.
 */
export const parseCpuMetrics = (rawResult: RawFlashlightResult): CpuMetrics => {
  const iterations = rawResult.iterations ?? [];
  let totalCpuSum = 0;
  let uiCpuSum = 0;
  let jsCpuSum = 0;
  let measureCount = 0;

  for (const iteration of iterations) {
    const measures = iteration.measures ?? [];
    for (const measure of measures) {
      measureCount += 1;
      const perName = measure.cpu?.perName ?? {};

      let measureTotalCpu = 0;
      let measureUiCpu = 0;
      let measureJsCpu = 0;

      for (const [threadName, cpuValue] of Object.entries(perName)) {
        measureTotalCpu += cpuValue;

        if (/(?:ui\s*thread|^ui$|^main$)/iu.test(threadName)) {
          measureUiCpu += cpuValue;
        } else if (/mqt.*js|react|javascript/iu.test(threadName)) {
          measureJsCpu += cpuValue;
        }
      }

      totalCpuSum +=
        measure.cpu?.total === undefined ? measureTotalCpu : measure.cpu.total;
      uiCpuSum += measureUiCpu;
      jsCpuSum += measureJsCpu;
    }
  }

  if (measureCount === 0) {
    return {
      jsThreadCpuPercent: 0,
      totalCpuPercent: 0,
      uiThreadCpuPercent: 0,
    };
  }

  return {
    jsThreadCpuPercent: Number((jsCpuSum / measureCount).toFixed(2)),
    totalCpuPercent: Number((totalCpuSum / measureCount).toFixed(2)),
    uiThreadCpuPercent: Number((uiCpuSum / measureCount).toFixed(2)),
  };
};

/**
 * Extracts normalized scenario identifier from file path.
 *
 * @param scenarioPath - Relative or absolute path to scenario file.
 * @returns Clean scenario base name without extension.
 */
export const resolveScenarioName = (scenarioPath: string): string => {
  const baseName = path.basename(scenarioPath);
  return baseName.replace(/\.(?:ya?ml|json|ts|js)$/u, "");
};

/**
 * Resolves connected Android device product model.
 *
 * @param executor - Process execution adapter.
 * @param deviceId - Optional ADB target device serial number.
 * @returns Product model string if available.
 */
export const resolveDeviceModel = async (
  executor: CommandExecutor = defaultExecutor,
  deviceId?: string
): Promise<string | undefined> => {
  const deviceArgs = deviceId ? ["-s", deviceId] : [];
  const result = await executor("adb", [
    ...deviceArgs,
    "shell",
    "getprop",
    "ro.product.model",
  ]);
  if (result.exitCode === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return undefined;
};

/**
 * Orchestrates complete hardware stabilization sequence before measurement.
 *
 * 1. Locks refresh rate to fixed frequency.
 * 2. Compiles application bytecode using ART speed profile.
 * 3. Enables airplane mode to cut background connectivity.
 * 4. Executes unmeasured warmup pass (if enabled).
 * 5. Pauses for cooldown thermal dissipation.
 *
 * @param options - Stabilization configuration options.
 */
export const runHardwareStabilization = async (
  options: StabilizationExecutionOptions
): Promise<void> => {
  const { executor } = options;
  const packageId = options.packageId ?? "com.pkcarreno.cron.preview";
  const refreshRateHz = options.refreshRateHz ?? 60;
  const maestroBin = options.maestroBin ?? "maestro";
  const cooldownSleepMs = options.cooldownSleepMs ?? 5000;
  const sleepFn = options.sleepFn ?? defaultSleep;
  const shouldWarmup = options.shouldWarmup ?? true;

  options.reporter?.(
    `[STABILIZE] Locking display refresh rate to ${refreshRateHz} Hz...`
  );
  await lockDisplayRefreshRate(executor, refreshRateHz, options.deviceId);

  options.reporter?.(
    `[STABILIZE] Compiling package ${packageId} with ART speed filter...`
  );
  await runArtCompilation(executor, packageId, options.deviceId);

  options.reporter?.("[STABILIZE] Enabling airplane mode...");
  await setAirplaneMode(executor, true, options.deviceId);

  if (shouldWarmup) {
    options.reporter?.(
      "[STABILIZE] Executing unmeasured warmup interaction pass..."
    );
    await runWarmupPass(
      executor,
      options.scenarioPath,
      maestroBin,
      options.deviceId
    );

    options.reporter?.(
      `[STABILIZE] Pausing for thermal cooldown (${cooldownSleepMs} ms)...`
    );
    await sleepFn(cooldownSleepMs);
  }
};

/**
 * Loads and parses Flashlight result from temporary results file or standard output.
 *
 * @param tempFilePath - Path to temporary JSON result file.
 * @param stdoutText - Process stdout stream fallback text.
 * @returns Structured Flashlight result payload.
 */
export const loadFlashlightRawResult = (
  tempFilePath: string,
  stdoutText: string
): RawFlashlightResult => {
  if (fs.existsSync(tempFilePath)) {
    try {
      const fileContent = fs.readFileSync(tempFilePath, "utf-8");
      return JSON.parse(fileContent) as RawFlashlightResult;
    } finally {
      try {
        fs.rmSync(tempFilePath, { force: true });
      } catch {
        // Ignore temp cleanup error
      }
    }
  }

  if (stdoutText.includes("iterations")) {
    try {
      return JSON.parse(stdoutText) as RawFlashlightResult;
    } catch {
      return {};
    }
  }

  return {};
};

/**
 * Persists structured BenchmarkResult payload to disk.
 *
 * @param result - Benchmark result document.
 * @param outputDirectory - Target storage directory.
 * @returns Resolved filesystem destination path.
 */
export const saveBenchmarkResult = (
  result: BenchmarkResult,
  outputDirectory: string
): string => {
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  const outputFilePath = path.join(
    outputDirectory,
    `${result.scenario}-${result.commit}.json`
  );
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2), "utf-8");
  return outputFilePath;
};

/**
 * Queries current process and Hermes thread CPU utilization via Android top.
 *
 * @param executor - Process execution adapter.
 * @param packageId - Android application package identifier.
 * @param deviceId - Optional ADB target device serial number.
 * @returns CPU utilization metrics for UI and JS threads.
 */
export const sampleProcessCpu = async (
  executor: CommandExecutor,
  packageId: string,
  deviceId?: string
): Promise<CpuMetrics> => {
  const deviceArgs = deviceId ? ["-s", deviceId] : [];
  try {
    const pidResult = await executor("adb", [
      ...deviceArgs,
      "shell",
      "pidof",
      packageId,
    ]);
    const [pid] = pidResult.stdout.trim().split(/\s+/u);
    if (!pid || pidResult.exitCode !== 0) {
      return {
        jsThreadCpuPercent: 0,
        totalCpuPercent: 0,
        uiThreadCpuPercent: 0,
      };
    }

    const topResult = await executor("adb", [
      ...deviceArgs,
      "shell",
      "top",
      "-b",
      "-n",
      "1",
      "-H",
      "-p",
      pid,
    ]);

    if (topResult.exitCode !== 0) {
      return {
        jsThreadCpuPercent: 0,
        totalCpuPercent: 0,
        uiThreadCpuPercent: 0,
      };
    }

    let uiThreadCpu = 0;
    let jsThreadCpu = 0;
    let totalCpu = 0;

    const lines = topResult.stdout.split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/u);
      if (parts.length >= 10 && /^\d+$/u.test(parts[0] ?? "")) {
        const cpuStr = parts.at(8);
        const threadName = parts.slice(10).join(" ");
        const cpuVal = Number(cpuStr ?? "0");
        if (!Number.isNaN(cpuVal)) {
          totalCpu += cpuVal;
          if (parts[0] === pid) {
            uiThreadCpu = cpuVal;
          }
          if (
            threadName.includes("mqt_") ||
            threadName.includes("hermes") ||
            threadName.includes("v_js")
          ) {
            jsThreadCpu = Math.max(jsThreadCpu, cpuVal);
          }
        }
      }
    }

    return {
      jsThreadCpuPercent: Number(jsThreadCpu.toFixed(2)),
      totalCpuPercent: Number(totalCpu.toFixed(2)),
      uiThreadCpuPercent: Number(uiThreadCpu.toFixed(2)),
    };
  } catch {
    return { jsThreadCpuPercent: 0, totalCpuPercent: 0, uiThreadCpuPercent: 0 };
  }
};

interface ExecutionMetricsPayload {
  cpuMetrics: CpuMetrics;
  gfxInfo: ParsedGfxInfo;
}

const runSequentialIterations = async (
  executor: CommandExecutor,
  scenarioPath: string,
  maestroBin: string,
  deviceId: string | undefined,
  iterationCount: number,
  reporter: (message: string) => void
): Promise<void> => {
  let i = 1;
  while (i <= iterationCount) {
    reporter(`[MEASURE] Iteration ${i}/${iterationCount}...`);
    // Sequential gesture execution is required for single-screen Android UI testing
    // eslint-disable-next-line no-await-in-loop
    await runWarmupPass(executor, scenarioPath, maestroBin, deviceId);
    i += 1;
  }
};

const executeFlashlightOrFallback = async (
  options: ExtendedMeasureOptions,
  executor: CommandExecutor,
  flashlightArgs: string[],
  tempResultsFilePath: string,
  reporter: (message: string) => void
): Promise<ExecutionMetricsPayload> => {
  const packageId = options.packageId ?? "com.pkcarreno.cron.preview";
  const flashlightBin = options.flashlightBin ?? "flashlight";
  const maestroBin = options.maestroBin ?? "maestro";
  const iterationCount = options.iterationCount ?? 10;

  reporter(
    `[MEASURE] Running Flashlight benchmark (${iterationCount} iterations)...`
  );
  const executionResult = await executor(flashlightBin, flashlightArgs);

  let cpuMetrics: CpuMetrics;

  if (executionResult.exitCode === 0) {
    const rawResult = loadFlashlightRawResult(
      tempResultsFilePath,
      executionResult.stdout
    );
    cpuMetrics = parseCpuMetrics(rawResult);
  } else {
    const isAtraceError =
      executionResult.stderr.includes("atrace") ||
      executionResult.stderr.includes("BAMPerfProfiler") ||
      executionResult.stderr.includes("Did not find trace folder");

    if (!isAtraceError) {
      throw new Error(
        `Flashlight execution failed with exit code ${executionResult.exitCode}: ${executionResult.stderr}`
      );
    }

    reporter(
      "[MEASURE] Flashlight atrace profiler is unavailable on this kernel."
    );
    reporter(
      `[MEASURE] Executing ${iterationCount} iterations via Maestro with native telemetry...`
    );
    await runSequentialIterations(
      executor,
      options.scenarioPath,
      maestroBin,
      options.deviceId,
      iterationCount,
      reporter
    );
    cpuMetrics = await sampleProcessCpu(executor, packageId, options.deviceId);
  }

  reporter("[MEASURE] Collecting SurfaceFlinger graphics telemetry...");
  const rawGfxOutput = await collectGfxInfo(
    executor,
    packageId,
    options.deviceId
  );
  const gfxInfo = parseGfxInfo(rawGfxOutput);

  return { cpuMetrics, gfxInfo };
};

/**
 * Executes performance benchmark with hardware stabilization and writes output artifact.
 *
 * Manages complete benchmarking lifecycle:
 * 1. Environment stabilization (refresh rate, ART compilation, airplane mode, warmup).
 * 2. SurfaceFlinger gfxinfo reset.
 * 3. Flashlight profiler execution over multi-iteration Maestro runs.
 * 4. SurfaceFlinger gfxinfo metric collection.
 * 5. Structured result aggregation and persistence in benchmark/results/.
 * 6. Guaranteed restoration of airplane mode in finally handler.
 *
 * @param options - Benchmark measurement runner configuration options.
 * @returns Fully populated benchmark result document.
 */
export const measureBenchmark = async (
  options: ExtendedMeasureOptions
): Promise<BenchmarkResult> => {
  const executor = options.executor ?? defaultExecutor;
  const packageId = options.packageId ?? "com.pkcarreno.cron.preview";
  const refreshRateHz = options.refreshRateHz ?? 60;
  const iterationCount = options.iterationCount ?? 10;
  const maestroBin = options.maestroBin ?? "maestro";
  const outputDirectory =
    options.outputDirectory ?? path.resolve(process.cwd(), "benchmark/results");
  const shouldWarmup = options.shouldWarmup ?? true;
  const shouldSkipStabilization = options.shouldSkipStabilization ?? false;
  const reporter = options.reporter ?? console.log;

  const scenarioName = resolveScenarioName(options.scenarioPath);
  const commit = await resolveGitCommitSha(executor, options.customCommit);
  const deviceModel = await resolveDeviceModel(executor, options.deviceId);

  let isAirplaneModeEnabled = false;

  try {
    if (!shouldSkipStabilization) {
      await runHardwareStabilization({
        cooldownSleepMs: options.cooldownSleepMs,
        deviceId: options.deviceId,
        executor,
        maestroBin,
        packageId,
        refreshRateHz,
        reporter,
        scenarioPath: options.scenarioPath,
        shouldWarmup,
        sleepFn: options.sleepFn,
      });
      isAirplaneModeEnabled = true;
    }

    reporter(`[MEASURE] Resetting SurfaceFlinger gfxinfo for ${packageId}...`);
    await resetGfxInfo(executor, packageId, options.deviceId);

    const tempResultsFilePath = path.join(
      os.tmpdir(),
      `flashlight-measure-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );

    const testCommand = options.deviceId
      ? `${maestroBin} test --device ${options.deviceId} ${options.scenarioPath}`
      : `${maestroBin} test ${options.scenarioPath}`;

    const flashlightArgs: string[] = [
      "test",
      "--bundleId",
      packageId,
      "--testCommand",
      testCommand,
      "--iterationCount",
      String(iterationCount),
      "--resultsFilePath",
      tempResultsFilePath,
    ];

    if (options.durationMs) {
      flashlightArgs.push("--duration", String(options.durationMs));
    }

    const { cpuMetrics, gfxInfo } = await executeFlashlightOrFallback(
      options,
      executor,
      flashlightArgs,
      tempResultsFilePath,
      reporter
    );

    const benchmarkResult: BenchmarkResult = {
      commit,
      device: {
        model: deviceModel,
        refreshRateHz,
      },
      durationMs: options.durationMs,
      hasWarmupExecuted: Boolean(shouldWarmup && !shouldSkipStabilization),
      iterationCount,
      metrics: {
        cpu: cpuMetrics,
        frameTime: gfxInfo.frameTime,
        jankPercentage: gfxInfo.jankPercentage,
      },
      packageId,
      scenario: scenarioName,
      timestamp: new Date().toISOString(),
    };

    const savedPath = saveBenchmarkResult(benchmarkResult, outputDirectory);
    reporter(`[SUCCESS] Benchmark results saved to: ${savedPath}`);

    return benchmarkResult;
  } finally {
    if (isAirplaneModeEnabled) {
      reporter("[STABILIZE] Restoring airplane mode...");
      try {
        await setAirplaneMode(executor, false, options.deviceId);
      } catch (error) {
        reporter(`[WARN] Failed to disable airplane mode: ${String(error)}`);
      }
    }
  }
};

const CLI_FLAG_HANDLERS: Record<
  string,
  (options: ExtendedMeasureOptions, optionValue?: string) => number
> = {
  "--device": (options, optionValue) => {
    if (optionValue) {
      options.deviceId = optionValue;
    }
    return 2;
  },
  "--duration": (options, optionValue) => {
    if (optionValue) {
      options.durationMs = Number(optionValue);
    }
    return 2;
  },
  "--iterations": (options, optionValue) => {
    if (optionValue) {
      options.iterationCount = Number(optionValue);
    }
    return 2;
  },
  "--no-warmup": (options) => {
    options.shouldWarmup = false;
    return 1;
  },
  "--output": (options, optionValue) => {
    if (optionValue) {
      options.outputDirectory = optionValue;
    }
    return 2;
  },
  "--package": (options, optionValue) => {
    if (optionValue) {
      options.packageId = optionValue;
    }
    return 2;
  },
  "--refresh-rate": (options, optionValue) => {
    const rate = Number(optionValue);
    if (rate === 60 || rate === 120) {
      options.refreshRateHz = rate;
    }
    return 2;
  },
  "--refreshRate": (options, optionValue) => {
    const rate = Number(optionValue);
    if (rate === 60 || rate === 120) {
      options.refreshRateHz = rate;
    }
    return 2;
  },
  "--scenario": (options, optionValue) => {
    if (optionValue) {
      options.scenarioPath = optionValue;
    }
    return 2;
  },
  "--skip-stabilization": (options) => {
    options.shouldSkipStabilization = true;
    return 1;
  },
};

/**
 * Parses command line arguments into structured measurement options.
 *
 * @param args - Array of command line argument strings.
 * @returns Configured measurement options.
 */
export const parseMeasureCliArgs = (args: string[]): ExtendedMeasureOptions => {
  const options: ExtendedMeasureOptions = {
    scenarioPath: ".maestro/perf/thumbwheel-scroll.yaml",
  };

  let index = 0;
  while (index < args.length) {
    const current = args[index];
    const next = args[index + 1];

    if (current && current in CLI_FLAG_HANDLERS) {
      const handler = CLI_FLAG_HANDLERS[current];
      if (handler) {
        index += handler(options, next);
        continue;
      }
    }

    if (current && !current.startsWith("-") && index === 0) {
      options.scenarioPath = current;
    }
    index += 1;
  }

  // If scenario is short name without path, resolve to .maestro/perf/<name>.yaml
  if (
    !options.scenarioPath.includes("/") &&
    !options.scenarioPath.includes("\\")
  ) {
    const withYaml = options.scenarioPath.endsWith(".yaml")
      ? options.scenarioPath
      : `${options.scenarioPath}.yaml`;
    options.scenarioPath = path.join(".maestro/perf", withYaml);
  }

  return options;
};

export const parseCliArguments = parseMeasureCliArgs;

if (isDirectScriptExecution(import.meta.filename)) {
  void (async () => {
    try {
      const cliOptions = parseMeasureCliArgs(process.argv.slice(2));
      const result = await measureBenchmark(cliOptions);
      console.log(
        `\nMeasurement complete for ${result.scenario} (${result.commit}):`
      );
      console.log(
        `  P50: ${result.metrics.frameTime.p50Ms} ms | P90: ${result.metrics.frameTime.p90Ms} ms | P99: ${result.metrics.frameTime.p99Ms} ms`
      );
      console.log(`  Jank: ${result.metrics.jankPercentage}%`);
      console.log(`  UI Thread CPU: ${result.metrics.cpu.uiThreadCpuPercent}%`);
      console.log(`  JS Thread CPU: ${result.metrics.cpu.jsThreadCpuPercent}%`);
      process.exit(0);
    } catch (error) {
      console.error("Benchmark measurement runner failed:", error);
      process.exit(1);
    }
  })();
}
