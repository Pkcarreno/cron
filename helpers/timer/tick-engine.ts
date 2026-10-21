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

  private animationFrameId: number | null = null;

  public onTickCallbacks: ((event: TickEvent) => void)[] = [];

  public start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    const now = getMonotonicTimestamp();
    this.startTime = now - this.totalElapsedMs;
    this.lastTickTime = now;

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  public pause() {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public reset() {
    this.pause();
    this.totalElapsedMs = 0;
  }

  public getElapsedMs(): number {
    if (this.isRunning) {
      return getMonotonicTimestamp() - this.startTime;
    }
    return this.totalElapsedMs;
  }

  private loop() {
    if (!this.isRunning) {
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());

    const now = getMonotonicTimestamp();
    const deltaMs = now - this.lastTickTime;
    this.totalElapsedMs = now - this.startTime;
    this.lastTickTime = now;

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
