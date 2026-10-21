export interface TickEvent {
  deltaMs: number;
  totalElapsedMs: number;
}

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
  private startTime = 0;
  private lastTickTime = 0;
  private totalElapsedMs = 0;
  private wallClockStartTime = 0;

  private animationFrameId: number | null = null;

  public onTickCallbacks: ((event: TickEvent) => void)[] = [];

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

    const wallNow = Date.now();
    this.totalElapsedMs = wallNow - this.wallClockStartTime;
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
      return Date.now() - this.wallClockStartTime;
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
  }

  public resumeLoop() {
    if (this.isRunning && this.animationFrameId === null) {
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
    if (this.animationFrameId === null && this.isRunning) {
      this.animationFrameId = requestAnimationFrame(() => this.loop());
    }
  }

  private loop() {
    if (!this.isRunning) {
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());

    const wallNow = Date.now();
    this.totalElapsedMs = wallNow - this.wallClockStartTime;

    const monoNow = getMonotonicTimestamp();
    const deltaMs = monoNow - this.lastTickTime;
    this.lastTickTime = monoNow;

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
