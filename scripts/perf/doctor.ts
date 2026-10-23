import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export type CommandExecutor = (
  command: string,
  args?: string[]
) => Promise<CommandResult>;

export interface CheckResult {
  category: string;
  isOk: boolean;
  message: string;
  remediation?: string;
}

export interface DeviceCheckResult extends CheckResult {
  deviceId?: string;
}

export interface ParsedRefreshRate {
  isLocked: boolean;
  isVariable: boolean;
  rateHz: number;
}

export interface DoctorOptions {
  executor?: CommandExecutor;
  reporter?: (output: string) => void;
}

export interface DoctorOutcome {
  exitCode: number;
  isSuccess: boolean;
  results: CheckResult[];
}

/**
 * Executes a shell command and captures status and output.
 */
export const defaultExecutor: CommandExecutor = async (
  command: string,
  args: string[] = []
): Promise<CommandResult> => {
  const fullCommand = [command, ...args].join(" ");
  try {
    const { stderr, stdout } = await execAsync(fullCommand);
    return {
      exitCode: 0,
      stderr: stderr.toString(),
      stdout: stdout.toString(),
    };
  } catch (error: unknown) {
    const err = error as { code?: number; stderr?: string; stdout?: string };
    return {
      exitCode: err.code ?? 1,
      stderr: err.stderr?.toString() ?? "",
      stdout: err.stdout?.toString() ?? "",
    };
  }
};

/**
 * Verifies if Android Debug Bridge (ADB) CLI is installed.
 */
export const checkAdbInstalled = async (
  executor: CommandExecutor = defaultExecutor
): Promise<CheckResult> => {
  const result = await executor("adb", ["version"]);
  if (result.exitCode === 0) {
    const firstLine = result.stdout.trim().split("\n")[0] ?? "Installed";
    return {
      category: "ADB CLI",
      isOk: true,
      message: `ADB CLI is available: ${firstLine}`,
    };
  }

  return {
    category: "ADB CLI",
    isOk: false,
    message: "Android Debug Bridge (ADB) CLI is not found in PATH.",
    remediation:
      "Install Android SDK Platform-Tools and ensure adb is accessible in PATH.",
  };
};

/**
 * Inspects connected Android devices or emulators.
 */
export const checkConnectedDevice = async (
  executor: CommandExecutor = defaultExecutor
): Promise<DeviceCheckResult> => {
  const result = await executor("adb", ["devices"]);
  if (result.exitCode !== 0) {
    return {
      category: "Connected Device",
      isOk: false,
      message: "Failed to query adb devices.",
      remediation: "Ensure the ADB server is running: adb start-server",
    };
  }

  const lines = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("List of devices"));

  if (lines.length === 0) {
    return {
      category: "Connected Device",
      isOk: false,
      message: "No active Android device or emulator detected.",
      remediation:
        "Connect an Android device with USB debugging enabled or launch an emulator (e.g. emulator @<avd_name>).",
    };
  }

  const unauthorized = lines.find((line) => line.includes("unauthorized"));
  if (unauthorized) {
    return {
      category: "Connected Device",
      isOk: false,
      message: "Connected Android device is unauthorized.",
      remediation:
        "Unlock the device screen and accept the USB debugging authorization prompt.",
    };
  }

  const offline = lines.find((line) => line.includes("offline"));
  if (offline) {
    return {
      category: "Connected Device",
      isOk: false,
      message: "Connected Android device is offline.",
      remediation:
        "Reconnect USB cable or restart ADB: adb kill-server && adb start-server",
    };
  }

  const activeDevice = lines.find((line) => line.includes("device"));
  if (activeDevice) {
    const [deviceId] = activeDevice.split(/\s+/u);
    return {
      category: "Connected Device",
      deviceId,
      isOk: true,
      message: `Active connected Android device detected: ${deviceId}`,
    };
  }

  return {
    category: "Connected Device",
    isOk: false,
    message: "No usable Android device detected.",
    remediation:
      "Check device connection with 'adb devices' and authorize debugging.",
  };
};

/**
 * Parses refresh rate values from dumpsys display output and system settings.
 */
export const parseRefreshRate = (
  dumpsysOutput: string,
  settings?: { min?: string; peak?: string }
): ParsedRefreshRate | null => {
  const minVal = settings?.min?.trim()
    ? Number(settings.min.trim())
    : Number.NaN;
  const peakVal = settings?.peak?.trim()
    ? Number(settings.peak.trim())
    : Number.NaN;

  const hasValidMin = !Number.isNaN(minVal) && minVal > 0;
  const hasValidPeak = !Number.isNaN(peakVal) && peakVal > 0;

  if (hasValidMin && hasValidPeak) {
    const isVariable = Math.abs(minVal - peakVal) > 0.5;
    return {
      isLocked: !isVariable,
      isVariable,
      rateHz: Math.round(peakVal),
    };
  }

  const isDumpsysVariable = dumpsysOutput.toLowerCase().includes("variable");

  const fpsMatch =
    dumpsysOutput.match(/(?<rate>\d+(?:\.\d+)?)\s*(?:fps|Hz)/iu) ??
    dumpsysOutput.match(/(?:fps|refreshRate)[=:\s]+(?<rate>\d+(?:\.\d+)?)/iu);

  if (fpsMatch?.groups?.rate) {
    const rawNumber = Number(fpsMatch.groups.rate);
    if (!Number.isNaN(rawNumber)) {
      return {
        isLocked: false,
        isVariable: isDumpsysVariable,
        rateHz: Math.round(rawNumber),
      };
    }
  }

  return null;
};

/**
 * Queries device display refresh rate, checking 60 Hz or 120 Hz.
 */
export const checkDisplayRefreshRate = async (
  executor: CommandExecutor = defaultExecutor,
  deviceId?: string
): Promise<CheckResult> => {
  if (!deviceId) {
    return {
      category: "Display Refresh Rate",
      isOk: false,
      message:
        "No active connected Android device found to query refresh rate.",
      remediation:
        "Connect an Android device or emulator first, then rerun 'pnpm perf:doctor'.",
    };
  }

  const deviceArg = ["-s", deviceId];

  const minResult = await executor("adb", [
    ...deviceArg,
    "shell",
    "settings",
    "get",
    "system",
    "min_refresh_rate",
  ]);
  const peakResult = await executor("adb", [
    ...deviceArg,
    "shell",
    "settings",
    "get",
    "system",
    "peak_refresh_rate",
  ]);
  const dumpsysResult = await executor("adb", [
    ...deviceArg,
    "shell",
    "dumpsys",
    "display",
  ]);

  const parsed = parseRefreshRate(dumpsysResult.stdout, {
    min: minResult.stdout,
    peak: peakResult.stdout,
  });

  if (!parsed) {
    return {
      category: "Display Refresh Rate",
      isOk: false,
      message: "Could not determine display refresh rate from device.",
      remediation:
        "Lock display to 60 Hz via ADB: adb shell settings put system min_refresh_rate 60.0 && adb shell settings put system peak_refresh_rate 60.0",
    };
  }

  if (parsed.isVariable) {
    return {
      category: "Display Refresh Rate",
      isOk: false,
      message: `Adaptive / variable display refresh rate detected (${parsed.rateHz} Hz). Benchmarking requires a fixed refresh rate.`,
      remediation:
        "Lock display refresh rate to 60 Hz: adb shell settings put system min_refresh_rate 60.0 && adb shell settings put system peak_refresh_rate 60.0",
    };
  }

  if (parsed.rateHz !== 60 && parsed.rateHz !== 120) {
    return {
      category: "Display Refresh Rate",
      isOk: false,
      message: `Unsupported display refresh rate (${parsed.rateHz} Hz). Benchmarking requires 60 Hz or 120 Hz.`,
      remediation:
        "Lock display to 60 Hz: adb shell settings put system min_refresh_rate 60.0 && adb shell settings put system peak_refresh_rate 60.0",
    };
  }

  return {
    category: "Display Refresh Rate",
    isOk: true,
    message: `Display refresh rate is ${parsed.rateHz} Hz${parsed.isLocked ? " (locked)" : ""}.`,
  };
};

/**
 * Checks whether Maestro CLI is installed.
 */
export const checkMaestroInstalled = async (
  executor: CommandExecutor = defaultExecutor
): Promise<CheckResult> => {
  const result = await executor("maestro", ["--version"]);
  if (result.exitCode === 0) {
    const version = result.stdout.trim() || "available";
    return {
      category: "Maestro CLI",
      isOk: true,
      message: `Maestro CLI is available: ${version}`,
    };
  }

  return {
    category: "Maestro CLI",
    isOk: false,
    message: "Maestro CLI is not found in PATH.",
    remediation:
      "Install Maestro via mise: run 'mise install maestro' or visit https://maestro.mobile.dev",
  };
};

/**
 * Checks whether Flashlight CLI is installed.
 */
export const checkFlashlightInstalled = async (
  executor: CommandExecutor = defaultExecutor
): Promise<CheckResult> => {
  const result = await executor("flashlight", ["--version"]);
  if (result.exitCode === 0) {
    const version = result.stdout.trim() || "available";
    return {
      category: "Flashlight CLI",
      isOk: true,
      message: `Flashlight CLI is available: ${version}`,
    };
  }

  return {
    category: "Flashlight CLI",
    isOk: false,
    message: "Flashlight CLI is not found in PATH.",
    remediation:
      "Install Flashlight via mise: run 'mise run flashlight-setup' or 'curl https://get.flashlight.dev | bash'",
  };
};

/**
 * Formats doctor check results into human- and agent-readable output.
 */
export const formatDoctorReport = (results: CheckResult[]): string => {
  const outputLines: string[] = [
    "============================================================",
    "               Performance Environment Doctor               ",
    "============================================================",
  ];

  for (const item of results) {
    const mark = item.isOk ? "[PASS]" : "[FAIL]";
    outputLines.push(`${mark} ${item.category}: ${item.message}`);
    if (!item.isOk && item.remediation) {
      outputLines.push(`       Remediation: ${item.remediation}`);
    }
  }

  const passedCount = results.filter((r) => r.isOk).length;
  outputLines.push(
    "============================================================",
    `Result: ${passedCount}/${results.length} checks passed.`
  );

  if (passedCount < results.length) {
    outputLines.push(
      "Action Required: Execute the remediation commands listed above before running benchmarks."
    );
  } else {
    outputLines.push("All performance environment preconditions satisfied.");
  }
  outputLines.push(
    "============================================================"
  );

  return outputLines.join("\n");
};

/**
 * Runs all performance diagnostics checks and reports results.
 */
export const runDoctor = async (
  options: DoctorOptions = {}
): Promise<DoctorOutcome> => {
  const executor = options.executor ?? defaultExecutor;
  const reporter = options.reporter ?? console.log;

  const adbCheck = await checkAdbInstalled(executor);
  const deviceCheck = await checkConnectedDevice(executor);
  const displayCheck = await checkDisplayRefreshRate(
    executor,
    deviceCheck.deviceId
  );
  const maestroCheck = await checkMaestroInstalled(executor);
  const flashlightCheck = await checkFlashlightInstalled(executor);

  const results: CheckResult[] = [
    adbCheck,
    deviceCheck,
    displayCheck,
    maestroCheck,
    flashlightCheck,
  ];

  const reportText = formatDoctorReport(results);
  reporter(reportText);

  const isSuccess = results.every((check) => check.isOk);
  return {
    exitCode: isSuccess ? 0 : 1,
    isSuccess,
    results,
  };
};

const isDirectScriptExecution = (): boolean => {
  if (!process.argv[1]) {
    return false;
  }
  return import.meta.filename === path.resolve(process.argv[1]);
};

if (isDirectScriptExecution()) {
  void (async () => {
    try {
      const outcome = await runDoctor();
      process.exit(outcome.exitCode);
    } catch (error) {
      console.error("Unexpected error in perf:doctor:", error);
      process.exit(1);
    }
  })();
}
