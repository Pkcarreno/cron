import {
  DoctorExitCode,
  checkAdbInstalled,
  checkCliTool,
  checkConnectedDevice,
  checkDisplayRefreshRate,
  checkFlashlightInstalled,
  checkMaestroInstalled,
  parseRefreshRate,
  runDoctor,
} from "./doctor";
import type { CommandExecutor } from "./types";

const createMockExecutor =
  (
    responses: Record<
      string,
      { exitCode: number; stderr: string; stdout: string }
    >
  ): CommandExecutor =>
  (command: string, args: string[] = []) => {
    const fullCmd = [command, ...args].join(" ");
    for (const [key, val] of Object.entries(responses)) {
      if (fullCmd.includes(key)) {
        return Promise.resolve(val);
      }
    }
    return Promise.resolve({
      exitCode: 1,
      stderr: `Command not found: ${fullCmd}`,
      stdout: "",
    });
  };

describe("Performance Doctor (scripts/perf/doctor)", () => {
  describe("checkAdbInstalled", () => {
    it("reports ok when adb is available", async () => {
      const executor = createMockExecutor({
        "adb version": {
          exitCode: 0,
          stderr: "",
          stdout: "Android Debug Bridge version 1.0.41",
        },
      });

      const result = await checkAdbInstalled(executor);
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("Android Debug Bridge version 1.0.41");
    });

    it("reports failure and actionable remediation when adb is missing", async () => {
      const executor = createMockExecutor({});

      const result = await checkAdbInstalled(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toBeDefined();
      expect(result.remediation).toContain("Android SDK Platform-Tools");
    });
  });

  describe("checkConnectedDevice", () => {
    it("reports ok and returns device ID when an active device is connected", async () => {
      const executor = createMockExecutor({
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout: "List of devices attached\nemulator-5554\tdevice\n\n",
        },
      });

      const result = await checkConnectedDevice(executor);
      expect(result.isOk).toBe(true);
      expect(result.deviceId).toBe("emulator-5554");
      expect(result.message).toContain("emulator-5554");
    });

    it("picks active connected device when an offline device is also listed", async () => {
      const executor = createMockExecutor({
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout:
            "List of devices attached\nstale-device\toffline\nemulator-5554\tdevice\n\n",
        },
      });

      const result = await checkConnectedDevice(executor);
      expect(result.isOk).toBe(true);
      expect(result.deviceId).toBe("emulator-5554");
      expect(result.message).toContain("emulator-5554");
    });

    it("reports failure when device is unauthorized", async () => {
      const executor = createMockExecutor({
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout: "List of devices attached\nemulator-5554\tunauthorized\n\n",
        },
      });

      const result = await checkConnectedDevice(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("USB debugging");
    });

    it("reports failure when the only connected device is offline", async () => {
      const executor = createMockExecutor({
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout: "List of devices attached\nemulator-5554\toffline\n\n",
        },
      });

      const result = await checkConnectedDevice(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("kill-server");
    });

    it("reports failure when no devices are connected", async () => {
      const executor = createMockExecutor({
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout: "List of devices attached\n\n",
        },
      });

      const result = await checkConnectedDevice(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("emulator");
    });
  });

  describe("parseRefreshRate", () => {
    it("parses 60.0 fps from dumpsys output", () => {
      const dumpsys = "DisplayDeviceInfo{... 1080 x 2400, 60.000004 fps, ...}";
      const parsed = parseRefreshRate(dumpsys);
      expect(parsed?.rateHz).toBe(60);
      expect(parsed?.isVariable).toBe(false);
    });

    it("parses 120.0 fps from dumpsys output", () => {
      const dumpsys = "DisplayDeviceInfo{... 1440 x 3120, 120.0 fps, ...}";
      const parsed = parseRefreshRate(dumpsys);
      expect(parsed?.rateHz).toBe(120);
      expect(parsed?.isVariable).toBe(false);
    });

    it("targets active mode indicators in dumpsys over earlier supported modes", () => {
      const dumpsys = `
        supportedModes:
          DisplayMode{id=1, width=1080, height=2400, fps=60.0}
          DisplayMode{id=2, width=1080, height=2400, fps=120.0}
        mActiveModeId=2
        DisplayMode{id=2, width=1080, height=2400, fps=120.0} (active)
      `;
      const parsed = parseRefreshRate(dumpsys);
      expect(parsed?.rateHz).toBe(120);
      expect(parsed?.isVariable).toBe(false);
    });

    it("targets mBaseDisplayInfo when present in dumpsys display output", () => {
      const dumpsys = `
        supportedModes=[DisplayMode{id=1, fps=60.0}, DisplayMode{id=2, fps=120.0}]
        mBaseDisplayInfo=DisplayInfo{"Built-in Screen", 120.0 fps}
      `;
      const parsed = parseRefreshRate(dumpsys);
      expect(parsed?.rateHz).toBe(120);
      expect(parsed?.isVariable).toBe(false);
    });

    it("detects variable refresh rate when min and peak rates differ", () => {
      const parsed = parseRefreshRate("", { min: "60.0", peak: "120.0" });
      expect(parsed?.isVariable).toBe(true);
      expect(parsed?.rateHz).toBe(120);
    });

    it("identifies locked 60 Hz when min and peak match", () => {
      const parsed = parseRefreshRate("", { min: "60.0", peak: "60.0" });
      expect(parsed?.isLocked).toBe(true);
      expect(parsed?.isVariable).toBe(false);
      expect(parsed?.rateHz).toBe(60);
    });
  });

  describe("checkDisplayRefreshRate", () => {
    it("reports failure when deviceId is missing", async () => {
      const executor = createMockExecutor({});
      const result = await checkDisplayRefreshRate(executor);

      expect(result.isOk).toBe(false);
      expect(result.message).toContain("No active connected Android device");
    });

    it("reports ok when display refresh rate is 60 Hz", async () => {
      const executor = createMockExecutor({
        "dumpsys display": {
          exitCode: 0,
          stderr: "",
          stdout: "1080 x 2400, 60.0 fps",
        },
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0\n",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0\n",
        },
      });

      const result = await checkDisplayRefreshRate(executor, "emulator-5554");
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("60 Hz");
    });

    it("reports ok when display refresh rate is 120 Hz", async () => {
      const executor = createMockExecutor({
        "dumpsys display": {
          exitCode: 0,
          stderr: "",
          stdout: "1440 x 3120, 120.0 fps",
        },
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "120.0\n",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "120.0\n",
        },
      });

      const result = await checkDisplayRefreshRate(executor, "emulator-5554");
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("120 Hz");
    });

    it("reports failure and actionable lock command when refresh rate is variable", async () => {
      const executor = createMockExecutor({
        "dumpsys display": {
          exitCode: 0,
          stderr: "",
          stdout: "variable fps",
        },
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0\n",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "120.0\n",
        },
      });

      const result = await checkDisplayRefreshRate(executor, "emulator-5554");
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("min_refresh_rate 60.0");
      expect(result.remediation).toContain("peak_refresh_rate 60.0");
    });

    it("reports failure when refresh rate is not 60 or 120 Hz (e.g. 90 Hz)", async () => {
      const executor = createMockExecutor({
        "dumpsys display": {
          exitCode: 0,
          stderr: "",
          stdout: "1080 x 2400, 90.0 fps",
        },
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "null\n",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "null\n",
        },
      });

      const result = await checkDisplayRefreshRate(executor, "emulator-5554");
      expect(result.isOk).toBe(false);
      expect(result.message).toContain("90 Hz");
      expect(result.remediation).toContain("settings put system");
    });
  });

  describe("checkCliTool", () => {
    it("reports ok when the tool exits with 0", async () => {
      const executor = createMockExecutor({
        "maestro --version": {
          exitCode: 0,
          stderr: "",
          stdout: "1.39.0",
        },
      });

      const result = await checkCliTool(
        executor,
        "maestro",
        "Maestro CLI",
        "Maestro CLI",
        "Install Maestro"
      );
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("1.39.0");
    });

    it("reports failure when the tool fails", async () => {
      const executor = createMockExecutor({});

      const result = await checkCliTool(
        executor,
        "maestro",
        "Maestro CLI",
        "Maestro CLI",
        "Install Maestro"
      );
      expect(result.isOk).toBe(false);
      expect(result.remediation).toBe("Install Maestro");
    });
  });

  describe("checkMaestroInstalled", () => {
    it("reports ok when maestro is available", async () => {
      const executor = createMockExecutor({
        "maestro --version": {
          exitCode: 0,
          stderr: "",
          stdout: "1.39.0",
        },
      });

      const result = await checkMaestroInstalled(executor);
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("1.39.0");
    });

    it("reports failure with mise install remediation when maestro is missing", async () => {
      const executor = createMockExecutor({});

      const result = await checkMaestroInstalled(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("mise install maestro");
    });
  });

  describe("checkFlashlightInstalled", () => {
    it("reports ok when flashlight is available", async () => {
      const executor = createMockExecutor({
        "flashlight --version": {
          exitCode: 0,
          stderr: "",
          stdout: "0.9.0",
        },
      });

      const result = await checkFlashlightInstalled(executor);
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("0.9.0");
    });

    it("reports ok when flashlight is available via -v flag", async () => {
      const executor = createMockExecutor({
        "flashlight -v": {
          exitCode: 0,
          stderr: "",
          stdout: "0.18.0",
        },
      });

      const result = await checkFlashlightInstalled(executor);
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("0.18.0");
    });

    it("reports failure with mise task remediation when flashlight is missing", async () => {
      const executor = createMockExecutor({});

      const result = await checkFlashlightInstalled(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("mise run flashlight-setup");
    });
  });

  describe("runDoctor", () => {
    const validPassingResponses = {
      "adb devices": {
        exitCode: 0,
        stderr: "",
        stdout: "List of devices attached\nemulator-5554\tdevice\n",
      },
      "adb version": {
        exitCode: 0,
        stderr: "",
        stdout: "Android Debug Bridge version 1.0.41",
      },
      "dumpsys display": {
        exitCode: 0,
        stderr: "",
        stdout: "60.0 fps",
      },
      "flashlight --version": {
        exitCode: 0,
        stderr: "",
        stdout: "0.9.0",
      },
      "maestro --version": {
        exitCode: 0,
        stderr: "",
        stdout: "1.39.0",
      },
      "settings get system min_refresh_rate": {
        exitCode: 0,
        stderr: "",
        stdout: "60.0",
      },
      "settings get system peak_refresh_rate": {
        exitCode: 0,
        stderr: "",
        stdout: "60.0",
      },
    };

    it("returns isSuccess=true and exitCode=0 when all checks pass", async () => {
      const executor = createMockExecutor(validPassingResponses);

      const reporter = jest.fn();
      const outcome = await runDoctor({ executor, reporter });

      expect(outcome.isSuccess).toBe(true);
      expect(outcome.exitCode).toBe(DoctorExitCode.SUCCESS);
      expect(outcome.results).toHaveLength(5);
      expect(reporter).toHaveBeenCalled();
    });

    it("returns exitCode=1 (MISSING_CLI_TOOL) when a CLI tool is missing", async () => {
      const executor = createMockExecutor({
        ...validPassingResponses,
        "maestro --version": {
          exitCode: 127,
          stderr: "maestro: not found",
          stdout: "",
        },
      });

      const reporter = jest.fn();
      const outcome = await runDoctor({ executor, reporter });

      expect(outcome.isSuccess).toBe(false);
      expect(outcome.exitCode).toBe(DoctorExitCode.MISSING_CLI_TOOL);
    });

    it("returns exitCode=2 (DEVICE_ERROR) when CLI tools exist but no device is found", async () => {
      const executor = createMockExecutor({
        ...validPassingResponses,
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout: "List of devices attached\n\n",
        },
      });

      const reporter = jest.fn();
      const outcome = await runDoctor({ executor, reporter });

      expect(outcome.isSuccess).toBe(false);
      expect(outcome.exitCode).toBe(DoctorExitCode.DEVICE_ERROR);
    });

    it("returns exitCode=3 (REFRESH_RATE_ERROR) when device is connected but refresh rate is invalid", async () => {
      const executor = createMockExecutor({
        ...validPassingResponses,
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "120.0",
        },
      });

      const reporter = jest.fn();
      const outcome = await runDoctor({ executor, reporter });

      expect(outcome.isSuccess).toBe(false);
      expect(outcome.exitCode).toBe(DoctorExitCode.REFRESH_RATE_ERROR);
    });
  });
});
