export interface TickEvent {
  deltaMs: number;
  totalElapsedMs: number;
}

export interface TickEngineOptions {
  highPrecision?: boolean;
}

// 20 Hz default sampling interval
export const DEFAULT_TICK_INTERVAL_MS = 50;

const getMonotonicTimestamp = (): number => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
};

export class TickEngine {
  private isRunning = false;
  private isHighPrecision = false;
  private startTime = 0;
  private lastTickTime = 0;
  private totalElapsedMs = 0;
  private wallClockStartTime = 0;

  private animationFrameId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  public onTickCallbacks: ((event: TickEvent) => void)[] = [];

  constructor(options?: TickEngineOptions | boolean) {
    if (typeof options === "boolean") {
      this.isHighPrecision = options;
    } else if (options?.highPrecision !== undefined) {
      this.isHighPrecision = options.highPrecision;
    }
  }

  public getIsHighPrecision(): boolean {
    return this.isHighPrecision;
  }

  public setHighPrecision(enabled: boolean): void {
    if (this.isHighPrecision === enabled) {
      return;
    }
    this.isHighPrecision = enabled;
    if (this.isRunning) {
      this.pauseLoop();
      this.startLoop();
    }
  }

  public start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    const wallNow = Date.now();
    this.wallClockStartTime = wallNow - this.totalElapsedMs;

    const monoNow = getMonotonicTimestamp();
    this.startTime = monoNow - this.totalElapsedMs;
    this.lastTickTime = monoNow;

    this.startLoop();
  }

  public pause() {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;
    this.pauseLoop();

    const monoNow = getMonotonicTimestamp();
    this.totalElapsedMs = monoNow - this.startTime;

    const wallNow = Date.now();
    this.wallClockStartTime = wallNow - this.totalElapsedMs;
  }

  public reset() {
    this.pause();
    this.totalElapsedMs = 0;
    this.wallClockStartTime = 0;
    this.startTime = 0;
    this.lastTickTime = 0;
  }

  public getElapsedMs(): number {
    if (this.isRunning) {
      const monoNow = getMonotonicTimestamp();
      return monoNow - this.startTime;
    }
    return this.totalElapsedMs;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public pauseLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public resumeLoop() {
    if (
      this.isRunning &&
      this.animationFrameId === null &&
      this.intervalId === null
    ) {
      const monoNow = getMonotonicTimestamp();
      this.lastTickTime = monoNow;
      this.startLoop();
    }
  }

  public catchUp(): TickEvent | null {
    if (!this.isRunning) {
      return null;
    }

    const wallNow = Date.now();
    const targetElapsedMs = Math.max(
      this.totalElapsedMs,
      wallNow - this.wallClockStartTime
    );
    const deltaMs = targetElapsedMs - this.totalElapsedMs;
    this.totalElapsedMs = targetElapsedMs;

    const monoNow = getMonotonicTimestamp();
    this.startTime = monoNow - targetElapsedMs;
    this.lastTickTime = monoNow;

    const event: TickEvent = {
      deltaMs,
      totalElapsedMs: this.totalElapsedMs,
    };

    this.notifyHandlers(event);
    return event;
  }

  private startLoop() {
    if (!this.isRunning) {
      return;
    }

    if (this.isHighPrecision) {
      if (this.animationFrameId === null) {
        this.animationFrameId = requestAnimationFrame(() => this.loop());
      }
    } else if (this.intervalId === null) {
      this.intervalId = setInterval(
        () => this.tick(),
        DEFAULT_TICK_INTERVAL_MS
      );
    }
  }

  private loop() {
    if (!this.isRunning) {
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
    this.tick();
  }

  private tick() {
    if (!this.isRunning) {
      return;
    }

    const monoNow = getMonotonicTimestamp();
    const deltaMs = monoNow - this.lastTickTime;
    this.lastTickTime = monoNow;
    this.totalElapsedMs = monoNow - this.startTime;

    const event: TickEvent = {
      deltaMs,
      totalElapsedMs: this.totalElapsedMs,
    };

    this.notifyHandlers(event);
  }

  private notifyHandlers(event: TickEvent) {
    for (const handler of this.onTickCallbacks) {
      try {
        handler(event);
      } catch (error) {
        console.error(
          "[TickEngine] Silence error detected in a callback tick",
          error
        );
      }
    }
  }
}
