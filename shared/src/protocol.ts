import type { CharacterAppearance } from "./characterCatalog";

export type Direction = "up" | "down" | "left" | "right";

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
};

export type RoomGuest = GuestProfile & PositionState & {
  lastSeenAt: number;
};

export type ClientMessage =
  | { type: "join"; nickname: string; appearance: CharacterAppearance }
  | { type: "move"; x: number; y: number; direction: Direction; moving: boolean; seq: number }
  | { type: "ping" }
  | { type: "leave" };

export type ServerMessage =
  | { type: "welcome"; guestId: string; guests: RoomGuest[] }
  | { type: "guest_joined"; guest: RoomGuest }
  | { type: "guest_moved"; guestId: string; position: PositionState }
  | { type: "guest_left"; guestId: string }
  | { type: "room_state"; guests: RoomGuest[] }
  | { type: "error"; code: "bad_message" | "room_full" | "rate_limited" };
