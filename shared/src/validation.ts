import { parseCharacterAppearance } from "./characterCatalog";
import {
  guestReactionIds,
  worldZoneIds,
  type ClientMessage,
  type Direction,
  type GuestReaction,
  type WorldZoneId
} from "./protocol";

const directions = new Set<Direction>(["up", "down", "left", "right"]);
const zones = new Set<WorldZoneId>(worldZoneIds);
const reactions = new Set<GuestReaction>(guestReactionIds);

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "join") {
    const nickname = sanitizeText(value.nickname, 16);
    if (!("appearance" in value)) return null;
    const appearance = parseCharacterAppearance(value.appearance);
    if (!nickname || !appearance || !zones.has(value.zoneId as WorldZoneId)) return null;
    return { type: "join", nickname, appearance, zoneId: value.zoneId as WorldZoneId };
  }

  if (value.type === "move") {
    if (typeof value.x !== "number" || typeof value.y !== "number") return null;
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
    if (!directions.has(value.direction as Direction)) return null;
    if (!zones.has(value.zoneId as WorldZoneId)) return null;
    if (typeof value.moving !== "boolean") return null;
    if (typeof value.seq !== "number" || !Number.isInteger(value.seq)) return null;
    return {
      type: "move",
      x: value.x,
      y: value.y,
      direction: value.direction as Direction,
      moving: value.moving,
      seq: value.seq,
      zoneId: value.zoneId as WorldZoneId
    };
  }

  if (value.type === "react") {
    if (!reactions.has(value.reaction as GuestReaction)) return null;
    return { type: "react", reaction: value.reaction as GuestReaction };
  }

  if (value.type === "ping") return { type: "ping" };
  if (value.type === "leave") return { type: "leave" };
  return null;
}
