import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const MAESTRO_DIR = path.resolve(ROOT_DIR, ".maestro");
const PERF_DIR = path.resolve(MAESTRO_DIR, "perf");
const SCRIPTS_DIR = path.resolve(MAESTRO_DIR, "scripts");

const THUMBWHEEL_FLOW = path.resolve(PERF_DIR, "thumbwheel-scroll.yaml");
const MENU_TABS_FLOW = path.resolve(PERF_DIR, "menu-tabs-swipe.yaml");
const TIMER_WORKOUT_FLOW = path.resolve(PERF_DIR, "timer-workout-run.yaml");
const SLEEP_SCRIPT = path.resolve(SCRIPTS_DIR, "sleep.js");

const ALL_FLOWS = [
  { name: "thumbwheel-scroll", path: THUMBWHEEL_FLOW },
  { name: "menu-tabs-swipe", path: MENU_TABS_FLOW },
  { name: "timer-workout-run", path: TIMER_WORKOUT_FLOW },
];

describe("Maestro Performance Benchmark Flows", () => {
  describe("file existence", () => {
    it.each(ALL_FLOWS)("contains $name flow file", ({ path: flowPath }) => {
      expect(fs.existsSync(flowPath)).toBe(true);
    });

    it("contains the sleep script helper", () => {
      expect(fs.existsSync(SLEEP_SCRIPT)).toBe(true);
    });
  });

  describe("sleep script helper (.maestro/scripts/sleep.js)", () => {
    it("provides a synchronous busy-wait loop accepting durationMs", () => {
      const content = fs.readFileSync(SLEEP_SCRIPT, "utf-8");
      expect(content).toMatch(/durationMs/u);
      expect(content).toMatch(/Date\.now\(\)/u);
      expect(content).toMatch(/while\s*\(/u);
    });
  });

  describe("maestro syntax check", () => {
    it.each(ALL_FLOWS)(
      "passes `maestro check-syntax` on $name flow",
      ({ path: flowPath }) => {
        const result = spawnSync("maestro", ["check-syntax", flowPath], {
          encoding: "utf-8",
        });

        expect(result.status).toBe(0);
        expect(result.error).toBeUndefined();
      }
    );
  });

  describe("flow specifications", () => {
    it.each(ALL_FLOWS)(
      "defines appId: com.pkcarreno.cron.preview for $name flow",
      ({ path: flowPath }) => {
        const content = fs.readFileSync(flowPath, "utf-8");
        expect(content).toMatch(/appId:\s*com\.pkcarreno\.cron\.preview/u);
      }
    );

    describe("thumbwheel-scroll.yaml", () => {
      it("defines explicit percentage coordinates with matching horizontal Y coordinates and settling checks", () => {
        const content = fs.readFileSync(THUMBWHEEL_FLOW, "utf-8");

        expect(content).toContain("input-number-trigger");
        expect(content).toContain("thumbwheel-picker");
        expect(content).toContain("number-picker-save-button");

        // Percentage coordinates with matching horizontal Y coordinates (e.g. 75%)
        expect(content).toMatch(/start:\s*["'][0-9]+%,\s*75%["']/u);
        expect(content).toMatch(/end:\s*["'][0-9]+%,\s*75%["']/u);

        // Settling checks using sleep.js
        expect(content).toContain("runScript:");
        expect(content).toContain("sleep.js");
        expect(content).toMatch(/durationMs:\s*1000/u);
      });
    });

    describe("menu-tabs-swipe.yaml", () => {
      it("defines horizontal swipe navigation across workout modes with settling checks", () => {
        const content = fs.readFileSync(MENU_TABS_FLOW, "utf-8");

        // Swiping across tabs with explicit durations
        expect(content).toMatch(/swipe:/u);
        expect(content).toMatch(/duration:\s*600/u);
        expect(content).toMatch(/start:\s*["']85%,\s*50%["']/u);
        expect(content).toMatch(/end:\s*["']15%,\s*50%["']/u);

        // Reverse navigation
        expect(content).toMatch(/start:\s*["']15%,\s*50%["']/u);
        expect(content).toMatch(/end:\s*["']85%,\s*50%["']/u);

        // Settling checks
        expect(content).toContain("sleep.js");
        expect(content).toMatch(/durationMs:\s*500/u);
      });
    });

    describe("timer-workout-run.yaml", () => {
      it("starts an active interval workout and records 15 seconds of execution without touch interaction", () => {
        const content = fs.readFileSync(TIMER_WORKOUT_FLOW, "utf-8");

        expect(content).toContain("menu-tab-INTERVAL");
        expect(content).toContain("start-timer-button");
        expect(content).toContain("timer-screen");

        // Records 15 seconds (15000ms) without touch interaction
        expect(content).toContain("sleep.js");
        expect(content).toMatch(/durationMs:\s*15000/u);
      });
    });
  });
});
