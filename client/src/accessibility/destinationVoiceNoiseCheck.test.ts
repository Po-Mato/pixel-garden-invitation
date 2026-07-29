import { describe, expect, it } from "vitest";
import { assessDestinationVoiceNoise } from "./destinationVoiceNoiseCheck";

describe("destinationVoiceNoiseCheck", () => {
  it("classifies quiet, moderate, and noisy microphone input", () => {
    expect(assessDestinationVoiceNoise(0.01).level).toBe("quiet");
    expect(assessDestinationVoiceNoise(0.05).level).toBe("moderate");
    expect(assessDestinationVoiceNoise(0.2).level).toBe("noisy");
  });
});
