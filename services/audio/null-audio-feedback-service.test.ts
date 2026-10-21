import { describe, expect, it } from "@jest/globals";

import { TimerPhase } from "@/helpers/timer/strategy";
import { NullAudioFeedbackService } from "@/services/audio/null-audio-feedback-service";

describe("NullAudioFeedbackService", () => {
  it("resolves all semantic audio cue methods without throwing", async () => {
    const service = new NullAudioFeedbackService();

    await expect(service.playCountdownBeep(3)).resolves.toBeUndefined();
    await expect(service.playGoCue()).resolves.toBeUndefined();
    await expect(service.playFinishCue(true)).resolves.toBeUndefined();
    await expect(
      service.playPhaseTransitionCue(TimerPhase.REST)
    ).resolves.toBeUndefined();
    await expect(service.playLapCue()).resolves.toBeUndefined();
    await expect(service.playRoundChangeCue?.(2)).resolves.toBeUndefined();

    expect(() => service.stopAudio()).not.toThrow();
  });
});
