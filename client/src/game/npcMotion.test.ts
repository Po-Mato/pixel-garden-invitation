import { describe, expect, it } from "vitest";
import { advanceNpcMotionMap, createNpcMotionMap, npcMotionFor } from "./npcMotion";
import { gardenWorld, getWorldZone } from "./world";

describe("npcMotion", () => {
  const zone = getWorldZone(gardenWorld, "bridal-room");
  const bride = zone.npcs[0];

  it("하객이 멀면 정해진 짧은 동선으로 걷는다", () => {
    const result = advanceNpcMotionMap(zone, createNpcMotionMap(zone), zone.spawn);
    const motion = npcMotionFor(zone, bride, result);
    expect(motion.moving).toBe(true);
    expect(motion.point).not.toEqual({ x: bride.x, y: bride.y });
  });

  it("하객이 가까우면 마주 보고 인사한다", () => {
    const motions = createNpcMotionMap(zone);
    const player = { x: bride.x, y: bride.y + 90 };
    const motion = npcMotionFor(zone, bride, advanceNpcMotionMap(zone, motions, player));
    expect(motion).toMatchObject({ moving: false, reaction: "greet", direction: "down" });
  });

  it("하객과 겹칠 만큼 가까우면 이동 가능한 옆 타일로 양보한다", () => {
    const motions = createNpcMotionMap(zone);
    const player = { x: bride.x, y: bride.y + 30 };
    const first = advanceNpcMotionMap(zone, motions, player);
    const motion = npcMotionFor(zone, bride, first);
    expect(motion.reaction).toBe("yield");
    expect(motion.point).not.toEqual({ x: bride.x, y: bride.y });

    const held = npcMotionFor(zone, bride, advanceNpcMotionMap(zone, first, player));
    expect(held).toMatchObject({ point: motion.point, moving: false, reaction: "yield" });
  });

  it("대화 중인 NPC는 이동하지 않고 하객을 바라본다", () => {
    const motions = createNpcMotionMap(zone);
    const motion = npcMotionFor(zone, bride, advanceNpcMotionMap(zone, motions, zone.spawn, ["bride"]));
    expect(motion).toMatchObject({ moving: false, reaction: "greet" });
  });

  it("NPC가 이동할 때 다른 NPC의 현재 타일을 예약 영역으로 비워 둔다", () => {
    const hall = getWorldZone(gardenWorld, "ceremony-hall");
    const motions = createNpcMotionMap(hall);
    const result = advanceNpcMotionMap(hall, motions, hall.spawn);
    const points = hall.npcs.map((npc) => npcMotionFor(hall, npc, result).point);
    expect(new Set(points.map((point) => `${point.x}:${point.y}`)).size).toBe(points.length);
    expect(Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)).toBeGreaterThanOrEqual(30);
  });
});
