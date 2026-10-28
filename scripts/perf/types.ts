export interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export type CommandExecutor = (
  command: string,
  args?: string[]
) => Promise<CommandResult>;

export interface FrameTimeMetrics {
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
}

export interface CpuMetrics {
  /** Hermes mqt_js thread utilization */
  jsThreadCpuPercent: number;
  totalCpuPercent: number;
  /** Android UI / main render thread utilization */
  uiThreadCpuPercent: number;
}

export interface BenchmarkMetrics {
  cpu: CpuMetrics;
  frameTime: FrameTimeMetrics;
  jankPercentage: number;
}

export interface BenchmarkDeviceInfo {
  model?: string;
  refreshRateHz: number;
}

export interface BenchmarkResult {
  commit: string;
  device?: BenchmarkDeviceInfo;
  durationMs?: number;
  iterationCount: number;
  metrics: BenchmarkMetrics;
  packageId: string;
  scenario: string;
  timestamp: string;
  warmupExecuted: boolean;
}

export interface HardwareStabilizationOptions {
  airplaneMode?: boolean;
  cooldownSleepMs?: number;
  executor?: CommandExecutor;
  packageId?: string;
  refreshRateHz?: 60 | 120;
  runArtCompilation?: boolean;
}

export interface MeasureOptions {
  cooldownSleepMs?: number;
  customCommit?: string;
  deviceId?: string;
  durationMs?: number;
  executor?: CommandExecutor;
  flashlightBin?: string;
  iterationCount?: number;
  maestroBin?: string;
  outputDirectory?: string;
  packageId?: string;
  refreshRateHz?: 60 | 120;
  reporter?: (message: string) => void;
  scenarioPath: string;
  skipStabilization?: boolean;
  warmup?: boolean;
}

export interface BuildOptions {
  buildType?: "apk" | "bundle";
  clean?: boolean;
  customCommit?: string;
  executor?: CommandExecutor;
  outputDirectory?: string;
  profile?: "preview" | "development" | "production";
  reporter?: (message: string) => void;
  sourceArtifactPath?: string;
}

export interface BuildResult {
  artifactPath: string;
  commit: string;
  isSuccess: boolean;
}

export interface BudgetThresholds {
  frameBudgetMs: {
    60: number;
    120: number;
  };
  jankRateMaxPercent: number;
  jsThreadCpuMaxPercent: number;
}

export const DEFAULT_BUDGET_THRESHOLDS: BudgetThresholds = {
  frameBudgetMs: {
    120: 8.33,
    60: 16.67,
  },
  jankRateMaxPercent: 2,
  jsThreadCpuMaxPercent: 15,
};

export type BudgetViolationType =
  | "FRAME_BUDGET"
  | "JANK_RATE"
  | "JS_THREAD_CPU";

export interface BudgetViolation {
  actual: number;
  limit: number;
  message: string;
  type: BudgetViolationType;
  unit: string;
}

export interface MetricDelta {
  baseline: number;
  candidate: number;
  delta: number;
  deltaPercent: number;
}

export interface ComparisonReport {
  baselineCommit: string;
  candidateCommit: string;
  deltas: {
    cpuJsThread: MetricDelta;
    cpuTotal: MetricDelta;
    cpuUiThread: MetricDelta;
    frameTimeP50: MetricDelta;
    frameTimeP90: MetricDelta;
    frameTimeP99: MetricDelta;
    jankPercentage: MetricDelta;
  };
  isPassingBudgets: boolean;
  refreshRateHz: number;
  scenario: string;
  violations: BudgetViolation[];
}

export interface CompareOptions {
  customThresholds?: Partial<BudgetThresholds>;
  failOnBudgetViolation?: boolean;
  reporter?: (output: string) => void;
}

export interface CompareResult {
  error?: string;
  exitCode: number;
  formattedTable: string;
  isSuccess: boolean;
  report?: ComparisonReport;
}
