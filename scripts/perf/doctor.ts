import type { CommandExecutor } from "./types";
import { defaultExecutor, isDirectScriptExecution } from "./utils";

export type CheckCategory =
  | "ADB CLI"
  | "Connected Device"
  | "Display Refresh Rate"
  | "Maestro CLI"
  | "Flashlight CLI";

export interface CheckResult {
  category: CheckCategory;
  isOk: boolean;
  message: string;
  remediation?: string;
}

export interface DeviceCheckResult extends CheckResult {
  deviceId?: string;
}

export interface RefreshRateSettings {
  min?: string;
  peak?: string;
}

export interface ParsedRefreshRate {
  isLocked: boolean;
  isVariable: boolean;
  rateHz: number;
}

/* oxlint-disable no-redeclare */
export const DoctorExitCode = {
  DEVICE_ERROR: 2,
  MISSING_CLI_TOOL: 1,
  REFRESH_RATE_ERROR: 3,
  SUCCESS: 0,
} as const;

export type DoctorExitCode =
  (typeof DoctorExitCode)[keyof typeof DoctorExitCode];
/* oxlint-enable no-redeclare */

export interface DoctorOptions {
  executor?: CommandExecutor;
  reporter?: (output: string) => void;
}

export interface DoctorOutcome {
  exitCode: DoctorExitCode;
  isSuccess: boolean;
  results: CheckResult[];
}

interface ParsedDeviceEntry {
  id: string;
  status: "device" | "offline" | "unauthorized";
}

/**
 * Verifies that the Android Debug Bridge (ADB) CLI binary exists in the host PATH.
 *
 * ADB provides the foundational communication channel for all device interactions,
 * including APK installation, ART compilation commands, and hardware configuration.
 * Missing ADB blocks all downstream benchmarking and profiling tasks.
 *
 * @param executor - Process command executor implementation.
 * @returns Diagnostic check result for ADB presence.
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
 * Verifies availability of third-party command-line benchmarking tools.
 *
 * Both Maestro and Flashlight must be accessible in PATH to orchestrate automated
 * UI flows and collect kernel-level performance telemetry. Extracting this check
 * ensures uniform version resolution and actionable remediation across tooling.
 *
 * @param executor - Process command executor implementation.
 * @param tool - Binary name to execute with `--version`.
 * @param category - Category associated with the check result.
 * @param friendlyName - User-facing tool display name for messages.
 * @param remediation - Command or documentation link to install missing tool.
 * @returns Diagnostic check result for the specified tool.
 */
export const checkCliTool = async (
  executor: CommandExecutor,
  tool: "maestro" | "flashlight",
  category: CheckCategory,
  friendlyName: string,
  remediation: string,
  preferredFlag: "-v" | "--version" = tool === "flashlight" ? "-v" : "--version"
): Promise<CheckResult> => {
  let result = await executor(tool, [preferredFlag]);
  if (result.exitCode !== 0) {
    const fallbackFlag = preferredFlag === "-v" ? "--version" : "-v";
    const fallbackResult = await executor(tool, [fallbackFlag]);
    if (fallbackResult.exitCode === 0) {
      result = fallbackResult;
    }
  }

  if (result.exitCode === 0) {
    const version = result.stdout.trim() || "available";
    return {
      category,
      isOk: true,
      message: `${friendlyName} is available: ${version}`,
    };
  }

  return {
    category,
    isOk: false,
    message: `${friendlyName} is not found in PATH.`,
    remediation,
  };
};

/**
 * Confirms that Maestro CLI is available to drive UI automation flows.
 *
 * Maestro drives deterministic user journeys (such as timer scrolling and sheet dismissal)
 * via Android Accessibility APIs. Missing Maestro blocks automated scenario reproduction.
 *
 * @param executor - Process command executor implementation.
 * @returns Diagnostic check result for Maestro CLI.
 */
export const checkMaestroInstalled = async (
  executor: CommandExecutor = defaultExecutor
): Promise<CheckResult> =>
  await checkCliTool(
    executor,
    "maestro",
    "Maestro CLI",
    "Maestro CLI",
    "Install Maestro via mise: run 'mise install maestro' or visit https://maestro.mobile.dev"
  );

/**
 * Confirms that Flashlight CLI is available to profile CPU and frame performance.
 *
 * Flashlight orchestrates on-device C++ profiling binaries and computes exact
 * thread metrics. Missing Flashlight prevents automated performance regression tracking.
 *
 * @param executor - Process command executor implementation.
 * @returns Diagnostic check result for Flashlight CLI.
 */
export const checkFlashlightInstalled = async (
  executor: CommandExecutor = defaultExecutor
): Promise<CheckResult> =>
  await checkCliTool(
    executor,
    "flashlight",
    "Flashlight CLI",
    "Flashlight CLI",
    "Install Flashlight via mise: run 'mise run flashlight-setup' or 'curl https://get.flashlight.dev | bash'"
  );

/**
 * Inspects ADB device listings to find an authorized and operational target.
 *
 * Benchmarking requires an active, responsive Android device or emulator.
 * When multiple devices are attached (such as an offline stale connection alongside an active device),
 * this check isolates the functional device to prevent false-negative diagnostic failures.
 *
 * @param executor - Process command executor implementation.
 * @returns Diagnostic check result containing the resolved target device ID.
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

  const deviceLineRegex =
    /^(?<id>[^\s]+)\s+(?<status>device|offline|unauthorized)$/u;
  const parsedDevices: ParsedDeviceEntry[] = [];

  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(deviceLineRegex);
    if (match?.groups?.id && match.groups.status) {
      parsedDevices.push({
        id: match.groups.id,
        status: match.groups.status as "device" | "offline" | "unauthorized",
      });
    }
  }

  if (parsedDevices.length === 0) {
    return {
      category: "Connected Device",
      isOk: false,
      message: "No active Android device or emulator detected.",
      remediation:
        "Connect an Android device with USB debugging enabled or launch an emulator (e.g. emulator @<avd_name>).",
    };
  }

  const activeDevice = parsedDevices.find((entry) => entry.status === "device");
  if (activeDevice) {
    return {
      category: "Connected Device",
      deviceId: activeDevice.id,
      isOk: true,
      message: `Active connected Android device detected: ${activeDevice.id}`,
    };
  }

  const unauthorizedDevice = parsedDevices.find(
    (entry) => entry.status === "unauthorized"
  );
  if (unauthorizedDevice) {
    return {
      category: "Connected Device",
      isOk: false,
      message: "Connected Android device is unauthorized.",
      remediation:
        "Unlock the device screen and accept the USB debugging authorization prompt.",
    };
  }

  const offlineDevice = parsedDevices.find(
    (entry) => entry.status === "offline"
  );
  if (offlineDevice) {
    return {
      category: "Connected Device",
      isOk: false,
      message: "Connected Android device is offline.",
      remediation:
        "Reconnect USB cable or restart ADB: adb kill-server && adb start-server",
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

const parseSettingsRefreshRate = (
  settings?: RefreshRateSettings
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

  return null;
};

const extractFpsFromText = (
  text: string,
  isVariable: boolean
): ParsedRefreshRate | null => {
  const fpsMatch =
    text.match(/(?<rate>\d+(?:\.\d+)?)\s*(?:fps|Hz)/iu) ??
    text.match(/(?:fps|refreshRate)[=:\s]+(?<rate>\d+(?:\.\d+)?)/iu);

  if (fpsMatch?.groups?.rate) {
    const rawNumber = Number(fpsMatch.groups.rate);
    if (!Number.isNaN(rawNumber)) {
      return {
        isLocked: false,
        isVariable,
        rateHz: Math.round(rawNumber),
      };
    }
  }

  return null;
};

const parseDumpsysRefreshRate = (
  dumpsysOutput: string
): ParsedRefreshRate | null => {
  const isDumpsysVariable = dumpsysOutput.toLowerCase().includes("variable");
  const lines = dumpsysOutput.split("\n");

  const activeFpsLine = lines.find(
    (line) =>
      (line.includes("mBaseDisplayInfo") ||
        (line.toLowerCase().includes("active") &&
          !line.toLowerCase().includes("inactive"))) &&
      /(?:fps|Hz|refreshRate)/iu.test(line)
  );

  if (activeFpsLine) {
    const activeRate = extractFpsFromText(activeFpsLine, isDumpsysVariable);
    if (activeRate) {
      return activeRate;
    }
  }

  const activeModeMatch = dumpsysOutput.match(/mActiveModeId=(?<modeId>\d+)/u);
  if (activeModeMatch?.groups?.modeId) {
    const { modeId } = activeModeMatch.groups;
    const modeLine = lines.find(
      (line) =>
        line.includes(`id=${modeId}`) && /(?:fps|Hz|refreshRate)/iu.test(line)
    );
    if (modeLine) {
      const modeRate = extractFpsFromText(modeLine, isDumpsysVariable);
      if (modeRate) {
        return modeRate;
      }
    }
  }

  return extractFpsFromText(dumpsysOutput, isDumpsysVariable);
};

/**
 * Evaluates display refresh rate settings and SurfaceFlinger display dumps.
 *
 * Deterministic frame budgets require a fixed display refresh rate (60 Hz or 120 Hz).
 * Adaptive refresh displays (LTPO) adjust frequency dynamically based on user interaction,
 * creating non-deterministic frame intervals and distorted metrics.
 *
 * When system settings for min/peak refresh rates are absent, this parser inspects
 * `dumpsys display` output. It specifically targets active mode lines (such as `mBaseDisplayInfo`,
 * `mActiveModeId`, or `active`) rather than the first entry in `supportedModes` to avoid
 * misidentifying supported but inactive display configurations.
 *
 * @param dumpsysOutput - Raw text output from `adb shell dumpsys display`.
 * @param settings - System refresh rate settings queried from Android settings provider.
 * @returns Parsed refresh rate metadata or null if no valid configuration was resolved.
 */
export const parseRefreshRate = (
  dumpsysOutput: string,
  settings?: RefreshRateSettings
): ParsedRefreshRate | null => {
  const fromSettings = parseSettingsRefreshRate(settings);
  if (fromSettings) {
    return fromSettings;
  }

  return parseDumpsysRefreshRate(dumpsysOutput);
};

/**
 * Verifies that the connected Android device operates at a locked 60 Hz or 120 Hz refresh rate.
 *
 * Variable refresh rates (LTPO) invalidate frame drop benchmarks by dynamically
 * scaling between 1 Hz and 120 Hz. This check verifies that system properties
 * `min_refresh_rate` and `peak_refresh_rate` are locked to identical target frequencies.
 *
 * @param executor - Process command executor implementation.
 * @param deviceId - Android device serial number or emulator identifier.
 * @returns Diagnostic check result for display refresh rate determinism.
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
 * Renders diagnostic outcomes into a structured tabular terminal report.
 *
 * Clear formatting helps automated CI pipelines and local engineers immediately identify
 * prerequisite failures and run the exact remediation commands required.
 *
 * @param results - Array of completed diagnostic check results.
 * @returns Human- and agent-readable formatted report string.
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
 * Orchestrates all environment diagnostic checks and derives a granular process exit code.
 *
 * Diagnostic execution order and exit code prioritization follow tool hierarchy:
 * 1. CLI tools (ADB, Maestro, Flashlight) must be present in PATH (`MISSING_CLI_TOOL = 1`).
 * 2. A usable, authorized Android device or emulator must be connected (`DEVICE_ERROR = 2`).
 * 3. Connected display refresh rate must be locked to 60 Hz or 120 Hz (`REFRESH_RATE_ERROR = 3`).
 *
 * @param options - Execution and reporting overrides for testing and CI integrations.
 * @returns Consolidated outcome with check results and prioritized exit code.
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

  let exitCode: DoctorExitCode = DoctorExitCode.SUCCESS;
  if (!isSuccess) {
    const hasCliFailure =
      !adbCheck.isOk || !maestroCheck.isOk || !flashlightCheck.isOk;
    if (hasCliFailure) {
      exitCode = DoctorExitCode.MISSING_CLI_TOOL;
    } else if (deviceCheck.isOk) {
      exitCode = displayCheck.isOk
        ? DoctorExitCode.MISSING_CLI_TOOL
        : DoctorExitCode.REFRESH_RATE_ERROR;
    } else {
      exitCode = DoctorExitCode.DEVICE_ERROR;
    }
  }

  return {
    exitCode,
    isSuccess,
    results,
  };
};

if (isDirectScriptExecution(import.meta.filename)) {
  void (async () => {
    try {
      const outcome = await runDoctor();
      process.exit(outcome.exitCode);
    } catch (error) {
      console.error("Unexpected error in perf:doctor:", error);
      process.exit(DoctorExitCode.MISSING_CLI_TOOL);
    }
  })();
}
