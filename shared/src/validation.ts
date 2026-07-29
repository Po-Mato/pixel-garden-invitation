import { parseCharacterAppearance } from "./characterCatalog";
import {
  companionPingIds,
  guestReactionIds,
  worldZoneIds,
  type ClientMessage,
  type CompanionPing,
  type Direction,
  type GuestReaction,
  type WorldZoneId
} from "./protocol";

const directions = new Set<Direction>(["up", "down", "left", "right"]);
const zones = new Set<WorldZoneId>(worldZoneIds);
const reactions = new Set<GuestReaction>(guestReactionIds);
const companionPings = new Set<CompanionPing>(companionPingIds);

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
    const resumeId = sanitizeText(value.resumeId, 64);
    if (!("appearance" in value)) return null;
    const appearance = parseCharacterAppearance(value.appearance);
    if (
      !nickname
      || !appearance
      || !zones.has(value.zoneId as WorldZoneId)
      || (resumeId && !/^[A-Za-z0-9_-]{12,64}$/.test(resumeId))
    ) return null;
    return {
      type: "join",
      nickname,
      appearance,
      zoneId: value.zoneId as WorldZoneId,
      ...(resumeId ? { resumeId } : {})
    };
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

  if (
    value.type === "companion_invite"
    || value.type === "companion_stop"
    || value.type === "companion_destination_request"
  ) {
    const targetGuestId = sanitizeText(value.targetGuestId, 80);
    if (!targetGuestId) return null;
    return { type: value.type, targetGuestId };
  }

  if (value.type === "companion_ping") {
    const targetGuestId = sanitizeText(value.targetGuestId, 80);
    if (!targetGuestId || !companionPings.has(value.ping as CompanionPing)) return null;
    return { type: "companion_ping", targetGuestId, ping: value.ping as CompanionPing };
  }

  if (value.type === "companion_reply") {
    const requesterGuestId = sanitizeText(value.requesterGuestId, 80);
    if (!requesterGuestId || typeof value.accepted !== "boolean") return null;
    return { type: "companion_reply", requesterGuestId, accepted: value.accepted };
  }

  if (value.type === "companion_rendezvous_propose") {
    const targetGuestId = sanitizeText(value.targetGuestId, 80);
    const proposalId = sanitizeText(value.proposalId, 64);
    if (
      !targetGuestId
      || !proposalId
      || !zones.has(value.zoneId as WorldZoneId)
      || typeof value.x !== "number"
      || !Number.isFinite(value.x)
      || typeof value.y !== "number"
      || !Number.isFinite(value.y)
    ) return null;
    return {
      type: "companion_rendezvous_propose",
      targetGuestId,
      proposalId,
      zoneId: value.zoneId as WorldZoneId,
      x: value.x,
      y: value.y
    };
  }

  if (value.type === "companion_rendezvous_reply") {
    const requesterGuestId = sanitizeText(value.requesterGuestId, 80);
    const proposalId = sanitizeText(value.proposalId, 64);
    if (!requesterGuestId || !proposalId || typeof value.accepted !== "boolean") return null;
    return { type: "companion_rendezvous_reply", requesterGuestId, proposalId, accepted: value.accepted };
  }

  if (value.type === "companion_rendezvous_cancel") {
    const targetGuestId = sanitizeText(value.targetGuestId, 80);
    const proposalId = sanitizeText(value.proposalId, 64);
    if (!targetGuestId || !proposalId) return null;
    return { type: "companion_rendezvous_cancel", targetGuestId, proposalId };
  }

  if (value.type === "companion_destination" || value.type === "companion_portal_ready") {
    const targetGuestId = sanitizeText(value.targetGuestId, 80);
    const portalId = sanitizeText(value.portalId, 100);
    if (!targetGuestId || !portalId || !zones.has(value.destinationZoneId as WorldZoneId)) return null;
    return {
      type: value.type,
      targetGuestId,
      portalId,
      destinationZoneId: value.destinationZoneId as WorldZoneId
    };
  }

  if (value.type === "ping") return { type: "ping" };
  if (value.type === "leave") return { type: "leave" };
  return null;
}
