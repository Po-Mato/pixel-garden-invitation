import type { CharacterAppearance } from "./characterCatalog";

export type Direction = "up" | "down" | "left" | "right";
export const guestReactionIds = ["wave", "heart", "applause", "celebrate"] as const;
export type GuestReaction = (typeof guestReactionIds)[number];
export const worldZoneIds = [
  "home",
  "neighborhood",
  "subway-station",
  "subway-train",
  "venue-exterior",
  "lobby",
  "bridal-room",
  "ceremony-hall",
  "banquet",
  "restroom"
] as const;
export type WorldZoneId = (typeof worldZoneIds)[number];

export type GuestProfile = {
  guestId: string;
  nickname: string;
  appearance: CharacterAppearance;
};

export type PositionState = {
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
  seq: number;
  zoneId: WorldZoneId;
};

export type RoomGuest = GuestProfile & PositionState & {
  lastSeenAt: number;
};

export type ClientMessage =
  | { type: "join"; nickname: string; appearance: CharacterAppearance; zoneId: WorldZoneId }
  | { type: "move"; x: number; y: number; direction: Direction; moving: boolean; seq: number; zoneId: WorldZoneId }
  | { type: "react"; reaction: GuestReaction }
  | { type: "ping" }
  | { type: "leave" };

export type ServerMessage =
  | { type: "welcome"; guestId: string; guests: RoomGuest[] }
  | { type: "guest_joined"; guest: RoomGuest }
  | { type: "guest_moved"; guestId: string; position: PositionState }
  | { type: "guest_reacted"; guestId: string; reaction: GuestReaction; zoneId: WorldZoneId }
  | { type: "guest_left"; guestId: string }
  | { type: "room_state"; guests: RoomGuest[] }
  | { type: "error"; code: "bad_message" | "room_full" | "rate_limited" };
