import { describe, expect, it } from "vitest";
import { createWorldAtmosphereParticles } from "./worldAtmosphere";

describe("맵 환경 효과 입자", () => {
  it("맵과 품질이 같으면 같은 위치를 재현한다", () => {
    const first = createWorldAtmosphereParticles("venue-exterior", ["petal", "glint"], "full");
    const second = createWorldAtmosphereParticles("venue-exterior", ["petal", "glint"], "full");
    expect(first).toEqual(second);
    expect(first).toHaveLength(16);
  });

  it("균형 모드는 수를 줄이고 절약 모드는 동적 입자를 만들지 않는다", () => {
    expect(createWorldAtmosphereParticles("home", ["mote"], "reduced")).toHaveLength(7);
    expect(createWorldAtmosphereParticles("home", ["mote"], "minimal")).toEqual([]);
  });
});
